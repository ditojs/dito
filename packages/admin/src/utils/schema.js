import DitoContext from '@/DitoContext'
import { getUid } from './uid'
import { SchemaGraph } from './SchemaGraph'
import { appendDataPath } from './data'
import {
  isObject, isString, isArray, isFunction, isPromise, clone, camelize
} from '@ditojs/utils'

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

export function forEachSchema(schema, callback) {
  const schemas = [
    ...Object.values(schema?.tabs || {}),
    schema
  ]
  for (const schema of schemas) {
    if (schema) {
      const res = callback(schema)
      if (res !== undefined) {
        return res
      }
    }
  }
}

export function forEachSchemaComponent(schema, callback) {
  return forEachSchema(schema, schema => {
    for (const [name, component] of Object.entries(schema.components || {})) {
      const res = callback(component, name)
      if (res !== undefined) {
        return res
      }
    }
  })
}

export function findSchemaComponent(schema, callback) {
  return forEachSchemaComponent(
    schema,
    (component, name) => callback(component, name) ? component : undefined
  ) || null
}

export function someSchemaComponent(schema, callback) {
  return forEachSchemaComponent(
    schema,
    (component, name) => callback(component, name) ? true : undefined
  ) === true
}

export function everySchemaComponent(schema, callback) {
  return forEachSchemaComponent(
    schema,
    (component, name) => !callback(component, name) ? false : undefined
  ) !== false
}

export async function resolveViews(unresolvedViews) {
  let views = isFunction(unresolvedViews)
    ? unresolvedViews()
    : unresolvedViews
  if (isPromise(views)) {
    views = await views
  }
  // Copy views to convert from module to object, and keep  a global reference:
  return { ...views }
}

export async function processView(component, api, schema, name, routes) {
  const children = []
  processRouteSchema(api, schema, name)
  if (isSingleComponentView(schema)) {
    await processComponent(api, schema, name, children, 0)
  } else {
    // A multi-component view, start at level 1
    await processSchemaComponents(api, schema, children, 1)
  }
  routes.push({
    path: `/${schema.path}`,
    children,
    component,
    meta: {
      api,
      schema
    }
  })
}

export function processComponent(api, schema, name, routes, level) {
  schema.level = level
  // Delegate schema processing to the actual type components.
  return getTypeOptions(schema)?.processSchema?.(
    api, schema, name, routes, level
  )
}

export function processRouteSchema(api, schema, name) {
  // Used for view and source schemas, see SourceMixin
  schema.name = name
  schema.path = schema.path || api.normalizePath(name)
}

export async function processSchemaComponents(api, schema, routes, level) {
  const promises = []
  forEachSchemaComponent(schema, (component, name) => {
    promises.push(processComponent(api, component, name, routes, level))
  })
  await Promise.all(promises)
}

export async function processForms(api, schema, level) {
  // First resolve the forms and store the results back on the schema.
  let { form, forms, components } = schema
  if (forms) {
    forms = schema.forms = await resolveForms(forms)
  } else if (form) {
    form = schema.form = await resolveForm(form)
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
    await processSchemaComponents(api, form, children, level + 1)
  }
  return children
}

export async function resolveForm(form) {
  if (isFunction(form)) {
    form = form()
  }
  if (isPromise(form)) {
    form = await form
  }
  // When dynamically importing forms, the actual form can be received named or
  // as `default` in a nested object, detect and handle this case:
  if (form && !('components' in form)) {
    const keys = Object.keys(form)
    // Assume the form is the first export (named or default)
    const name = keys[0]
    form = form[name]
    if (form && name !== 'default') {
      form.name = name
    }
  }
  return form
}

export async function resolveForms(forms) {
  const results = await Promise.all(Object.values(forms).map(resolveForm))
  return Object.keys(forms).reduce(
    (mapped, key, index) => {
      mapped[key] = results[index]
      return mapped
    },
    {}
  )
}

export function isSingleComponentView(schema) {
  // If the schema has a type, it is a single-component view.
  return !!schema.type
}

export function hasForms(schema) {
  // Support both single form and multiple forms notation, as well as inlined
  // components.
  return isObject(schema) && !!(
    schema.form ||
    schema.forms ||
    schema.components
  )
}

export function getViewSchema(schema, context) {
  const { view } = schema
  const viewSchema = view && context.views[view]
  return viewSchema
    ? hasForms(viewSchema)
      ? viewSchema
      // NOTE: Views can have tabs, in which case the view component is nested
      // in one of the tabs, go find it.
      : forEachSchema(viewSchema, schema => {
        const viewComponent = schema.components?.[view]
        if (hasForms(viewComponent)) {
          return viewComponent
        }
      })
    : null
}

export function getViewEditPath(schema, context) {
  const view = getViewSchema(schema, context)
  return view
    ? view.level === 0
      ? `/${view.path}` // A single-component view
      : `/${view.path}/${view.path}` // A multi-component view
    : null
}

export function getFormSchemas(schema, context, modifyForm) {
  const view = getViewSchema(schema, context)
  if (view) {
    schema = view
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
      if (isFunction(form.components)) {
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

export function hasLabel(schema) {
  return schema.label !== false
}

export function isCompact(schema) {
  return !!schema.compact
}

export function isInlined(schema) {
  return !!(schema.inlined || schema.components)
}

export function isNested(schema) {
  return !!(
    schema.nested ||
    getTypeOptions(schema)?.defaultNested === true
  )
}

export function shouldOmitPadding(schema) {
  return !!getTypeOptions(schema)?.omitPadding
}

export function getDefaultValue(schema) {
  // Support default values both on schema and on component level.
  // NOTE: At the time of creation, components may not be instantiated, (e.g. if
  // entries are created through nested forms, the parent form isn't mounted) so
  // we can't use `dataPath` to get to components, and the `defaultValue` from
  // there. That's why `defaultValue` is defined statically in the components:
  const defaultValue = schema.default
  const value = defaultValue !== undefined
    ? defaultValue
    : getTypeOptions(schema)?.defaultValue
  return isFunction(value)
    ? value(schema)
    : clone(value)
}

export function ignoreMissingValue(schema) {
  const typeOptions = getTypeOptions(schema)
  return !!(
    typeOptions?.excludeValue ||
    typeOptions?.ignoreMissingValue?.(schema)
  )
}

export function hasLabels(schema) {
  const checkComponents = components =>
    Object.values(components || {}).some(hasLabel)

  return (
    checkComponents(schema.components) ||
    Object.values(schema.tabs || {}).some(checkComponents)
  )
}

export function setDefaults(schema, data = {}, component) {
  const options = { component, rootData: data }

  const processBefore = (schema, data, name) => {
    if (!(name in data) && !ignoreMissingValue(schema)) {
      data[name] = getDefaultValue(schema)
    }
  }

  // Sets up a data object that has keys with default values for all
  // form fields, so they can be correctly watched for changes.
  return processSchemaData(
    schema, data, null, null, processBefore, null, options
  )
}

function shallowClone(schema, data, options) {
  const idKey = schema.idKey || 'id'
  return isObject(data)
    ? options.schemaOnly
      ? { [idKey]: data[idKey] }
      : { ...data }
    : isArray(data)
      ? [...data]
      : data
}

export function processData(schema, data, dataPath, {
  component,
  schemaOnly, // wether to only include data covered by the schema, or all data
  target
} = {}) {
  const options = { component, schemaOnly, target, rootData: data }
  const processedData = shallowClone(schema, data, options)
  const graph = new SchemaGraph()

  const processBefore = (schema, data, name, dataPath, processedData) => {
    const { wrapPrimitives } = schema
    let value = data[name]
    // The schema expects the `wrapPrimitives` transformations to be present on
    // the data that it is applied on, so warp before and unwrap after.
    if (wrapPrimitives && isArray(value)) {
      value = value.map(entry => ({
        [wrapPrimitives]: entry
      }))
    }
    processedData[name] = value
  }

  const processAfter = (schema, data, name, dataPath, processedData) => {
    const { wrapPrimitives, exclude, process } = schema
    let value = processedData[name]

    const typeOptions = getTypeOptions(schema)

    let context = null
    const getContext = () => (context ||= DitoContext.get(component, {
      value,
      name,
      data,
      dataPath,
      rootData: options.rootData,
      // Pass the already processed data to `process()`, so it can be modified
      // through `processedItem` from there.
      processedData
    }))

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
      return
    }

    // Each component type can provide its own static `processValue()` method.
    const processValue = typeOptions?.processValue
    if (processValue) {
      value = processValue(schema, value, dataPath, graph)
    }

    // Lastly unwrap the wrapped primitives again, to bring the data back into
    // its native form. Se `processBefore()` for more details.
    if (wrapPrimitives && isArray(value)) {
      value = value.map(object => object[wrapPrimitives])
    }

    processedData[name] = value
  }

  processSchemaData(
    schema, data, dataPath, processedData, processBefore, processAfter, options
  )

  return graph.process(schema, processedData, options)
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
    const getDataPath = (dataPath, token) => dataPath != null
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
            const dataPath = index !== null
              ? getDataPath(componentDataPath, index)
              : componentDataPath
            const context = DitoContext.get(options.component, {
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
                ? shallowClone(form, item, options)
                : null
              // Copy over type in case there are multiple forms to choose from.
              if (processedItem && Object.keys(forms).length > 1) {
                processedItem.type = item.type
              }
              return processSchemaData(
                form,
                item,
                dataPath,
                processedItem,
                processBefore,
                processAfter,
                options
              )
            }
            return { ...item }
          }

          processBefore?.(
            componentSchema, data, name, componentDataPath, processedData
          )
          let value = processedData ? processedData[name] : data[name]
          if (value != null && hasForms(componentSchema)) {
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
            componentSchema, data, name, componentDataPath, processedData
          )
        }
      }
    }
  }

  processComponents(schema.components)
  if (schema.tabs) {
    for (const tab of Object.values(schema.tabs)) {
      processComponents(tab.components)
    }
  }
  for (const panel of getAllPanelSchemas(schema, dataPath)) {
    processComponents(panel.schema.components)
  }

  return processedData || data
}

export function getNamedSchemas(descriptions, defaults) {
  const toObject = (array, toSchema) => {
    return array.length > 0
      ? array.reduce((object, value) => {
        const schema = toSchema(value)
        if (schema) {
          object[schema.name] = schema && defaults
            ? { ...defaults, ...schema }
            : schema
        }
        return object
      }, {})
      : null
  }

  return isArray(descriptions)
    ? toObject(descriptions, value => (
      isObject(value) ? value : {
        name: camelize(value, false)
      }
    ))
    : isObject(descriptions)
      ? toObject(
        Object.entries(descriptions),
        ([name, value]) =>
          isObject(value) ? {
            name,
            ...value
          }
          : isString(value) ? {
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
  return getTypeComponent(getType(schemaOrType), true)?.options ?? null
}

export function getSourceType(schemaOrType) {
  return getTypeOptions(schemaOrType)?.getSourceType?.(
    getType(schemaOrType)
  ) ?? null
}

export function getPanelSchema(schema, dataPath) {
  return schema
    ? {
      schema,
      // If the panel provides its own name, append it to the dataPath.
      // This is used e.g. for $filters panels.
      dataPath: schema.name
        ? appendDataPath(dataPath, schema.name)
        : dataPath
    }
    : null
}

export function getPanelSchemas(schemas, dataPath, panels = []) {
  if (schemas) {
    for (const [key, schema] of Object.entries(schemas)) {
      const panel = getPanelSchema(schema, appendDataPath(dataPath, key))
      if (panel) {
        panels.push(panel)
      }
    }
  }
  return panels
}

export function getAllPanelSchemas(schema, dataPath, schemaComponent = null) {
  const panel = getTypeOptions(schema)?.getPanelSchema?.(
    schema,
    dataPath,
    schemaComponent
  )
  const panels = panel ? [getPanelSchema(panel, dataPath)] : []
  // Allow each component to provide its own set of panels, in
  // addition to the default one (e.g. $filter):
  getPanelSchemas(schema.panels, dataPath, panels)
  return panels
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
