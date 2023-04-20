import DitoContext from '../DitoContext.js'
import DitoMixin from '../mixins/DitoMixin.js'
import TypeMixin from '../mixins/TypeMixin.js'
import { getUid } from './uid.js'
import { SchemaGraph } from './SchemaGraph.js'
import { appendDataPath, isTemporaryId } from './data.js'
import {
  isObject,
  isString,
  isArray,
  isFunction,
  isPromise,
  isModule,
  clone,
  merge,
  camelize,
  mapConcurrently
} from '@ditojs/utils'
import { markRaw } from 'vue'

const typeComponents = {}
const unknownTypeReported = {}

export function registerTypeComponent(type, component) {
  typeComponents[type] = component
}

export function getTypeComponent(type, allowNull = false) {
  const component = typeComponents[type] || null
  if (!component && !allowNull && !unknownTypeReported[type]) {
    // Report each missing type only once, to avoid flooding the console:
    unknownTypeReported[type] = true
    throw new Error(`Unknown Dito component type: '${type}'`)
  }
  return component
}

export function iterateSchemaComponents(schemas, callback) {
  for (const schema of schemas) {
    if (isSingleComponentView(schema)) {
      const res = callback(schema.component, schema.name, 0)
      if (res !== undefined) {
        return res
      }
    } else {
      for (const [name, component] of Object.entries(schema.components || {})) {
        const res = callback(component, name, 1)
        if (res !== undefined) {
          return res
        }
      }
    }
  }
}

export function iterateNestedSchemaComponents(schema, callback) {
  return schema
    ? iterateSchemaComponents([schema, ...getTabSchemas(schema)], callback)
    : undefined
}

export function findSchemaComponent(schema, callback) {
  return (
    iterateNestedSchemaComponents(
      schema,
      component => (callback(component) ? component : undefined)
    ) || null
  )
}

export function someSchemaComponent(schema, callback) {
  return (
    iterateNestedSchemaComponents(
      schema,
      component => (callback(component) ? true : undefined)
    ) === true
  )
}

export function everySchemaComponent(schema, callback) {
  return (
    iterateNestedSchemaComponents(
      schema,
      component => (callback(component) ? undefined : false)
    ) !== false
  )
}

export function isSchema(schema) {
  return isObject(schema) && isString(schema.type)
}

export function isForm(schema) {
  return isSchema(schema) && schema.type === 'form'
}

export function isView(schema) {
  return isSchema(schema) && schema.type === 'view'
}

export function isTab(schema) {
  return isSchema(schema) && schema.type === 'tab'
}

export function isPanel(schema) {
  return isSchema(schema) && schema.type === 'panel'
}

export function getSchemaIdentifier(schema) {
  return schema.name || schema.label || schema.type
}

export async function resolveSchema(schema, unwrapModule = false) {
  if (isFunction(schema)) {
    schema = schema()
  }
  if (isPromise(schema)) {
    schema = await schema
  }
  if (isModule(schema)) {
    // Copy to convert from module to object:
    schema = { ...schema }
    // Unwrap default or named schema
    if (!schema.name && (unwrapModule || schema.default)) {
      const keys = Object.keys(schema)
      if (keys.length === 1) {
        const name = keys[0]
        schema = schema[name]
        if (name !== 'default') {
          schema.name = name
        }
      }
    }
  }
  return schema
}

export async function resolveSchemas(
  unresolvedSchemas,
  resolveItem = resolveSchema
) {
  let schemas = isFunction(unresolvedSchemas)
    ? unresolvedSchemas()
    : unresolvedSchemas
  schemas = await resolveSchema(schemas, false)
  if (isArray(schemas)) {
    // Translate an array of dynamic import, each importing one named schema
    // module to an object with named entries.
    schemas = Object.fromEntries(
      await mapConcurrently(
        schemas,
        async item => {
          const schema = await resolveItem(item, true)
          return [schema.name, schema]
        }
      )
    )
  } else if (isObject(schemas)) {
    schemas = Object.fromEntries(
      await mapConcurrently(
        Object.entries(schemas),
        async ([key, item]) => {
          const schema = await resolveItem(item, true)
          return [key, schema]
        }
      )
    )
  }
  return schemas
}

export async function resolveSchemaComponent(schema) {
  // Resolves async schema components and adds DitoMixin and TypeMixin to them.
  let { component } = schema
  if (component) {
    component = await resolveSchema(component, true)
    if (component) {
      // Prevent warning: "Vue received a Component which was made a reactive
      // object. This can lead to unnecessary performance overhead, and should
      // be avoided by marking the component with `markRaw`":
      schema.component = markRaw({
        ...component,
        mixins: [DitoMixin, TypeMixin, ...(component.mixins || [])]
      })
    }
  }
}

export async function resolveSchemaComponents(schemas) {
  // `schemas` are of the same possible forms as passed to `getNamedSchemas()`
  await mapConcurrently(Object.values(schemas || {}), resolveSchemaComponent)
}

export async function processSchemaComponents(
  api,
  schema,
  routes = null,
  level = 0
) {
  const promises = []
  const process = (component, name, relativeLevel) => {
    promises.push(
      processSchemaComponent(
        api,
        component,
        name,
        routes,
        level + relativeLevel
      )
    )
  }

  iterateNestedSchemaComponents(schema, process)
  iterateSchemaComponents(getPanelSchemas(schema), process)

  await Promise.all(promises)
}

export async function processSchemaComponent(
  api,
  schema,
  name,
  routes = null,
  level = 0
) {
  processSchemaDefaults(api, schema)

  await Promise.all([
    // Also process nested panel schemas.
    mapConcurrently(
      getPanelSchemas(schema),
      panel => processSchemaComponents(api, panel, routes, level)
    ),
    // Delegate schema processing to the actual type components.
    getTypeOptions(schema)?.processSchema?.(
      api,
      schema,
      name,
      routes,
      level
    )
  ])
}

export async function processView(component, api, schema, name) {
  if (!isView(schema)) {
    throw new Error(`Invalid view schema: '${getSchemaIdentifier(schema)}'`)
  }
  processRouteSchema(api, schema, name)
  processSchemaDefaults(api, schema)
  await processNestedSchemas(api, schema)
  const children = []
  await processSchemaComponents(api, schema, children, 0)
  return {
    path: `/${schema.path}`,
    children,
    component,
    meta: {
      api,
      schema
    }
  }
}

export function processSchemaDefaults(api, schema) {
  let defaults = api.defaults[schema.type]
  if (defaults) {
    if (isFunction(defaults)) {
      defaults = defaults(schema)
    }
    if (isObject(defaults)) {
      for (const [key, value] of Object.entries(defaults)) {
        if (schema[key] === undefined) {
          schema[key] = value
        } else {
          schema[key] = merge(value, schema[key])
        }
      }
    }
  }
}

export function processNestedSchemaDefaults(api, schema) {
  // Process defaults for nested schemas. Note that this is also done when
  // calling `processSchemaComponents()`, but that function is async, and we
  // need a sync version that only handles the defaults for filters, see
  // `getFiltersPanel()`.
  iterateNestedSchemaComponents(schema, component => {
    processSchemaDefaults(api, component)
    const forms = getFormSchemas(component)
    for (const form of Object.values(forms)) {
      processNestedSchemaDefaults(api, form)
    }
  })
}

export function processRouteSchema(api, schema, name) {
  // Used for view and source schemas, see SourceMixin.
  schema.name = name
  schema.path ||= api.normalizePath(name)
}

export async function processForms(api, schema, level) {
  // First resolve the forms and store the results back on the schema.
  let { form, forms, components } = schema
  if (forms) {
    forms = schema.forms = await resolveSchemas(forms, form =>
      processForm(api, form)
    )
  } else if (form) {
    form = schema.form = await processForm(api, form)
  } else if (components) {
    // NOTE: Processing forms in computed components is not supported, since it
    // only can be computed in conjunction with actual data.
    if (isObject(components)) {
      form = { components }
    }
  }

  forms ||= { default: form } // Only used for process loop below.
  const children = []
  for (const form of Object.values(forms)) {
    await processSchemaComponents(api, form, children, level)
  }
  return children
}

export async function processForm(api, schema) {
  schema = await resolveSchema(schema, true)
  if (!isForm(schema)) {
    throw new Error(`Invalid form schema: '${getSchemaIdentifier(schema)}'`)
  }
  processSchemaDefaults(api, schema)
  await processNestedSchemas(api, schema)
  return schema
}

export async function processTab(api, schema) {
  schema = await resolveSchema(schema, true)
  if (!isTab(schema)) {
    throw new Error(`Invalid tab schema: '${getSchemaIdentifier(schema)}'`)
  }
  processSchemaDefaults(api, schema)
  return schema
}

export async function processPanel(api, schema) {
  schema = await resolveSchema(schema, true)
  if (!isPanel(schema)) {
    throw new Error(`Invalid panel schema: '${getSchemaIdentifier(schema)}'`)
  }
  processSchemaDefaults(api, schema)
  return schema
}

export async function processNestedSchemas(api, schema) {
  const { tabs, panels } = schema
  if (tabs) {
    schema.tabs = await resolveSchemas(
      tabs,
      tab => processTab(api, tab)
    )
  }
  if (panels) {
    schema.panels = await resolveSchemas(
      panels,
      panel => processPanel(api, panel)
    )
  }
}

export function hasFormSchema(schema) {
  // Support both single form and multiple forms notation, as well as inlined
  // components.
  return (
    isSchema(schema) &&
    isObject(schema.form || schema.forms || schema.components)
  )
}

export function hasMultipleFormSchemas(schema) {
  return (
    isSchema(schema) &&
    Object.keys(schema?.forms || {}).length > 1
  )
}

export function isSingleComponentView(schema) {
  return (
    isView(schema) &&
    isObject(schema.component)
  )
}

export function getViewFormSchema(schema, context) {
  const { view } = schema
  const viewSchema = view && context.views[view]
  return viewSchema
    ? // NOTE: Views can have tabs, in which case the view component is nested
      // in one of the tabs, go find it.
      findSchemaComponent(viewSchema, hasFormSchema) || null
    : null
}

export function getViewSchema(schema, context) {
  return getViewFormSchema(schema, context)
    ? context.views[schema.view]
    : null
}

export function getViewEditPath(schema, context) {
  const view = getViewSchema(schema, context)
  return view
    ? isSingleComponentView(view)
      ? `/${view.path}`
      : `/${view.path}/${view.path}`
    : null
}

export function getFormSchemas(schema, context, modifyForm) {
  const viewSchema = context && getViewFormSchema(schema, context)
  if (viewSchema) {
    schema = viewSchema
  } else if (schema.view) {
    throw new Error(`Unknown view: '${schema.view}'`)
  }

  let { form, forms, components, compact } = schema
  if (!form && !forms) {
    if (components) {
      // Convert inlined components to forms, supporting `compact` setting.
      form = { components, compact }
    } else {
      // No `forms`, `form` or `components`, return and empty `forms` object.
      return {}
    }
  }
  forms ||= { default: form }
  return Object.fromEntries(
    Object.entries(forms).map(([type, form]) => {
      // Support `schema.components` callbacks to create components on the fly.
      if (context && isFunction(form.components)) {
        form = {
          ...form,
          components: form.components(context)
        }
      }
      return [type, modifyForm?.(form) ?? form]
    })
  )
}

export function getItemFormSchemaFromForms(forms, item) {
  return forms[item?.type] || forms.default || null
}

export function getItemFormSchema(schema, item, context) {
  return getItemFormSchemaFromForms(getFormSchemas(schema, context), item)
}

export function isCompact(schema) {
  return !!schema.compact
}

export function isInlined(schema) {
  return !!(schema.inlined || schema.components)
}

export function isNested(schema) {
  return !!(schema.nested || getTypeOptions(schema)?.defaultNested === true)
}

export function omitPadding(schema) {
  return !!getTypeOptions(schema)?.omitPadding
}

export function alignBottom(schema) {
  return !!getTypeOptions(schema)?.alignBottom
}

export function getDefaultValue(schema) {
  // Support default values both on schema and on component level.
  // NOTE: At the time of creation, components may not be instantiated, (e.g. if
  // entries are created through nested forms, the parent form isn't mounted) so
  // we can't use `dataPath` to get to components, and the `defaultValue` from
  // there. That's why `defaultValue` is defined statically in the components:
  const defaultValue = schema.default
  const value =
    defaultValue !== undefined
      ? defaultValue
      : getTypeOptions(schema)?.defaultValue
  return isFunction(value)
    ? value(schema)
    : clone(value)
}

export function ignoreMissingValue(schema) {
  const typeOptions = getTypeOptions(schema)
  return !!(
    typeOptions?.excludeValue || typeOptions?.ignoreMissingValue?.(schema)
  )
}

export function setDefaultValues(schema, data = {}, component) {
  const options = { component, rootData: data }

  const processBefore = (schema, data, name) => {
    if (!(name in data) && !ignoreMissingValue(schema)) {
      data[name] = getDefaultValue(schema)
    }
  }

  // Sets up a data object that has keys with default values for all
  // form fields, so they can be correctly watched for changes.
  return processSchemaData(
    schema,
    data,
    null,
    null,
    processBefore,
    null,
    options
  )
}

export function computeValue(schema, data, name, dataPath, {
  component = null,
  rootData = component?.rootData
} = {}) {
  const { compute } = schema
  if (compute) {
    const value = compute(
      DitoContext.get(component, {
        schema,
        // Override value to prevent endless recursion through calling the
        // getter for `this.value` in `DitoContext`:
        value: data[name],
        name,
        data,
        dataPath,
        rootData
      })
    )
    if (value !== undefined) {
      // Access `data[name]` directly instead of `this.value = …` to update the
      // value without calling parse():
      data[name] = value
    }
  }
  // If the value is still missing after compute, set the default for it:
  if (!(name in data) && !ignoreMissingValue(schema)) {
    data[name] = getDefaultValue(schema)
  }
  // Now access the value. This is important for reactivity and needs to
  // happen after all prior manipulation of `data[name]`, see above:
  return data[name]
}

function cloneItem(sourceSchema, item, options) {
  if (options.schemaOnly) {
    const copy = {}
    const { idKey = 'id', orderKey } = sourceSchema
    const id = item[idKey]
    if (id !== undefined) {
      copy[idKey] = id
    }
    // Copy over type in case there are multiple forms to choose from.
    if (hasMultipleFormSchemas(sourceSchema)) {
      copy.type = item.type
    }
    if (orderKey) {
      copy[orderKey] = item[orderKey]
    }
    return copy
  } else {
    return { ...item }
  }
}

export function processData(schema, sourceSchema, data, dataPath, {
  component,
  schemaOnly, // whether to only include data covered by the schema, or all data
  target
} = {}) {
  const options = { component, schemaOnly, target, rootData: data }
  const processedData = cloneItem(sourceSchema, data, options)
  const graph = new SchemaGraph()

  const processBefore = (schema, data, name, dataPath, processedData) => {
    let value = computeValue(schema, data, name, dataPath, options)
    // The schema expects the `wrapPrimitives` transformations to be present on
    // the data that it is applied on, so warp before and unwrap after.
    if (isArray(value)) {
      const { wrapPrimitives, orderKey, idKey = 'id' } = schema
      if (wrapPrimitives) {
        value = value.map(entry => ({
          [wrapPrimitives]: entry
        }))
      } else {
        // Always shallow-clone array values:
        value = [...value]
      }
      if (orderKey && target === 'clipboard') {
        // Sort the data back into the natural sequence as defined by their ids,
        // so copy-pasting between servers (e.g. nested font-cuts on Lineto)
        // naturally gets mapped to the same entries in the graph.
        value.sort((a, b) => {
          const id1 = a?.[idKey]
          const id2 = b?.[idKey]
          return id1 == null || isTemporaryId(id1)
            ? 1
            : id2 == null || isTemporaryId(id2)
              ? -1
              : id1 - id2
        })
      }
    }
    processedData[name] = value
  }

  const processAfter = (schema, data, name, dataPath, processedData) => {
    const { wrapPrimitives, exclude, process } = schema
    let value = processedData[name]

    const typeOptions = getTypeOptions(schema)

    // NOTE: We don't cache this context, since `value` is changing.
    const getContext = () =>
      DitoContext.get(component, {
        schema,
        value,
        name,
        data,
        dataPath,
        rootData: options.rootData,
        // Pass the already processed data to `process()`, so it can be modified
        // through `processedItem` from there.
        processedData
      })

    // First unwrap the wrapped primitives again, to bring the data back into
    // its native form. Se `processBefore()` for more details.
    if (wrapPrimitives && isArray(value)) {
      value = value.map(object => object[wrapPrimitives])
    }

    // Handle the user's `process()` callback first, if one is provided, so that
    // it can modify data in `processedData` even if it provides `exclude: true`
    if (process) {
      value = process(getContext())
    }

    if (
      typeOptions?.excludeValue ||
      // Support functions next to booleans for `schema.exclude`:
      exclude === true ||
      isFunction(exclude) && exclude(getContext())
    ) {
      delete processedData[name]
    } else {
      // Each component type can provide its own static `processValue()` method
      // to convert the data for storage.
      const processValue = typeOptions?.processValue
      if (processValue) {
        value = processValue(schema, value, dataPath, graph)
      }
      processedData[name] = value
    }
  }

  processSchemaData(
    schema,
    data,
    dataPath,
    processedData,
    processBefore,
    processAfter,
    options
  )

  return graph.process(sourceSchema, processedData, options)
}

export function processSchemaData(
  schema,
  data,
  dataPath,
  processedData,
  processBefore,
  processAfter,
  options
) {
  const processComponents = components => {
    const getDataPath = (dataPath, token) =>
      dataPath != null
        ? appendDataPath(dataPath, token)
        : null

    if (components) {
      for (const [name, componentSchema] of Object.entries(components)) {
        if (!isNested(componentSchema)) {
          // Recursively process data on unnested components.
          processSchemaData(
            componentSchema,
            data,
            dataPath,
            processedData,
            processBefore,
            processAfter,
            options
          )
        } else {
          const componentDataPath = getDataPath(dataPath, name)

          const processItem = (item, index = null) => {
            const dataPath =
              index !== null
                ? getDataPath(componentDataPath, index)
                : componentDataPath
            const context = DitoContext.get(options.component, {
              schema: componentSchema,
              data,
              value: item,
              dataPath,
              index,
              rootData: options.rootData
            })
            const getForms = (
              getTypeOptions(componentSchema)?.getFormSchemasForProcessing ||
              getFormSchemas
            )
            const forms = getForms(componentSchema, context)
            const form = getItemFormSchemaFromForms(forms, item)
            if (form) {
              const processedItem = processedData
                ? cloneItem(componentSchema, item, options)
                : null
              return processSchemaData(
                form,
                item,
                dataPath,
                processedItem,
                processBefore,
                processAfter,
                options
              )
            } else {
              // Items without forms still get fully (but shallowly) cloned.
              // TODO: Find out of this is actually needed / used at all?
              return { ...item }
            }
          }

          processBefore?.(
            componentSchema,
            data,
            name,
            componentDataPath,
            processedData
          )
          let value = processedData ? processedData[name] : data[name]
          if (value != null && hasFormSchema(componentSchema)) {
            // Recursively process data on nested form items.
            if (isArray(value)) {
              // Optimization: No need to collect values if we're not cloning!
              value = processedData
                ? value.map(processItem)
                : value.forEach(processItem)
            } else {
              value = processItem(value)
            }
            if (processedData) {
              processedData[name] = value
            }
          }
          processAfter?.(
            componentSchema,
            data,
            name,
            componentDataPath,
            processedData
          )
        }
      }
    }
  }

  processComponents(schema.components)
  for (const tab of getTabSchemas(schema)) {
    processComponents(tab.components)
  }
  for (const panel of getPanelSchemas(schema)) {
    processComponents(panel.components)
  }

  return processedData || data
}

export function getNamedSchemas(schemas, defaults) {
  const toObject = (array, toSchema) => {
    return array.length > 0
      ? array.reduce((object, value) => {
          const schema = toSchema(value)
          if (schema) {
            object[schema.name] =
              schema && defaults
                ? { ...defaults, ...schema }
                : schema
          }
          return object
        }, {})
      : null
  }

  return isArray(schemas)
    ? toObject(schemas, value =>
        isObject(value)
          ? value
          : {
              name: camelize(value, false)
            }
      )
    : isObject(schemas)
      ? toObject(
          Object.entries(schemas),
          ([name, value]) =>
            isObject(value)
              ? {
                  name,
                  ...value
                }
              : isString(value)
                ? {
                    name,
                    label: value
                  }
                : null
        )
      : null
}

export function getButtonSchemas(buttons) {
  return getNamedSchemas(
    buttons,
    { type: 'button' } // Defaults
  )
}

function getType(schemaOrType) {
  return isObject(schemaOrType) ? schemaOrType.type : schemaOrType
}

export function getTypeOptions(schemaOrType) {
  return getTypeComponent(getType(schemaOrType), true) ?? null
}

export function getSourceType(schemaOrType) {
  return (
    getTypeOptions(schemaOrType)?.getSourceType?.(getType(schemaOrType)) ??
    null
  )
}

export function getPanelEntry(schema, dataPath = null, tabComponent = null) {
  return schema
    ? {
        schema,
        // If the panel provides its own name, append it to the dataPath.
        // This is used e.g. for $filters panels.
        dataPath:
          dataPath != null && schema.name
            ? appendDataPath(dataPath, schema.name)
            : dataPath,
        tabComponent
      }
    : null
}

export function getPanelEntries(
  panelSchemas,
  dataPath = null,
  tabComponent = null,
  panelEntries = []
) {
  if (panelSchemas) {
    for (const [key, schema] of Object.entries(panelSchemas)) {
      const entry = getPanelEntry(
        schema,
        dataPath != null ? appendDataPath(dataPath, key) : null,
        tabComponent
      )
      if (entry) {
        panelEntries.push(entry)
      }
    }
  }
  return panelEntries
}

export function getTabSchemas(schema) {
  return schema?.tabs ? Object.values(schema.tabs) : []
}

export function getPanelSchemas(schema) {
  return schema?.panels ? Object.values(schema.panels) : []
}

export function getAllPanelEntries(
  api,
  schema,
  dataPath = null,
  schemaComponent = null,
  tabComponent = null
) {
  const panelSchema = getTypeOptions(schema)?.getPanelSchema?.(
    api,
    schema,
    dataPath,
    schemaComponent
  )
  const panelEntries = panelSchema
    ? [getPanelEntry(panelSchema, dataPath, tabComponent)]
    : []
  // Allow each component to provide its own set of panels, in
  // addition to the default one (e.g. getFiltersPanel(), $filters):
  getPanelEntries(schema?.panels, dataPath, tabComponent, panelEntries)
  return panelEntries
}

export function isObjectSource(schemaOrType) {
  return getSourceType(schemaOrType) === 'object'
}

export function isListSource(schemaOrType) {
  return getSourceType(schemaOrType) === 'list'
}

export function getItemId(sourceSchema, item) {
  const id = item[sourceSchema.idKey || 'id']
  return id != null ? String(id) : undefined
}

export function getItemUid(sourceSchema, item) {
  // Try to use the item id as the uid, falling back on auto-generated ids, but
  // either way, pass through `getUid()` so that the ids are associated with the
  // item through a weak map, as the ids can be filtered out in `processData()`
  // while the components that use the uids as key are still visible.
  return getUid(item, getItemId(sourceSchema, item))
}
