import { appendDataPath, shallowClone } from './data'
import { getUid } from './uid'
import DitoContext from '@/DitoContext'
import {
  isObject, isString, isArray, isFunction, isPromise, clone, camelize
} from '@ditojs/utils'

const typeComponents = {}
const unknownTypeReported = {}

export function registerTypeComponent(type, component) {
  typeComponents[type] = component
}

export function getTypeComponent(type) {
  const component = typeComponents[type] || null
  if (!component && !unknownTypeReported[type]) {
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

export async function resolveViews(views) {
  if (isFunction(views)) {
    views = views()
  }
  if (isPromise(views)) {
    views = await views
  }

  return views
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
  let { form, forms } = schema
  if (forms) {
    forms = schema.forms = await resolveForms(forms)
  } else if (form) {
    form = schema.form = await resolveForm(form)
    forms = { default: form } // Only used for loop below.
  }
  const children = []
  if (forms) {
    for (const form of Object.values(forms)) {
      await processSchemaComponents(api, form, children, level + 1)
    }
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
    // Only extract form if there's only one property (named or default)
    if (keys.length === 1) {
      const name = keys[0]
      form = form[name]
      if (form && name !== 'default') {
        form.name = name
      }
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
  // Support both single form and multiple forms notation.
  return isObject(schema) && !!(schema.form || schema.forms)
}

export function getViewSchema(schema, views) {
  const { view } = schema
  const viewSchema = view && views[view]
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

export function getViewEditPath(schema, views) {
  const view = getViewSchema(schema, views)
  return view
    ? view.level === 0
      ? `/${view.path}` // A single-component view
      : `/${view.path}/${view.path}` // A multi-component view
    : null
}

export function getFormSchemas(schema, views = null) {
  if (views) {
    const view = getViewSchema(schema, views)
    if (view) {
      schema = view
    } else if (schema.view) {
      throw new Error(`Unknown view: '${schema.view}'`)
    }
  }
  const { form, forms } = schema
  return forms || { default: form }
}

export function getItemFormSchema(schema, item, views = null) {
  const forms = getFormSchemas(schema, views)
  return forms[item?.type] || forms.default
}

export function hasLabel(schema) {
  return schema.label !== false
}

export function isCompact(schema) {
  return schema.compact
}

export function isUnnested(schema) {
  return !!getTypeOptions(schema)?.unnested?.(schema)
}

export function shouldOmitPadding(schema) {
  return schema.omitPadding || !!getTypeOptions(schema)?.omitPadding?.(schema)
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
  const type = getType(schema)
  const typeOptions = getTypeOptions(type)
  return !!(
    typeOptions?.excludeValue ||
    typeOptions?.ignoreMissingValue?.(type)
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

export function setDefaults(schema, data = {}) {
  function processBefore(schema, data, name) {
    if (!(name in data) && !ignoreMissingValue(schema)) {
      data[name] = getDefaultValue(schema)
    }
  }
  // Sets up a data object that has keys with default values for all
  // form fields, so they can be correctly watched for changes.
  return processSchemaData(schema, data, null, processBefore)
}

export function processData(schema, data, dataPath, options = {}) {
  // Include `rootData` in options, so tha it can be passed to components'
  // `processValue()` which pass it to `processData()` again from nested calls.
  // But pass the already cloned data to `process()`, so it can be modified.
  const rootData = options?.rootData ?? data
  options = { rootData, ...options }

  function processBefore(schema, data, name, dataPath, clone) {
    const { wrapPrimitives } = schema
    const value = clone[name]

    // The schema expects the `wrapPrimitives` transformations to be present on
    // the data that it is applied on, so warp before and unwrap after.
    if (wrapPrimitives && isArray(value)) {
      clone[name] = value.map(entry => ({
        [wrapPrimitives]: entry
      }))
    }
  }

  function processAfter(schema, data, name, dataPath, clone) {
    const { wrapPrimitives, exclude, process } = schema
    let value = clone[name]

    const typeOptions = getTypeOptions(schema)

    const getContext = () => new DitoContext(null, {
      value,
      name,
      data,
      dataPath,
      rootData,
      // Pass the already cloned data to `process()` as `processedData`,
      // so it can be modified through `processedItem` from there.
      processedData: clone
    })

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
      delete clone[name]
      return
    }

    // Each component type can provide its own static `processValue()` method.
    const processValue = typeOptions?.processValue
    if (processValue) {
      value = processValue.call(typeOptions, schema, value, dataPath, options)
    }

    // Lastly unwrap the wrapped primitives again, to bring the data back into
    // its native form. Se `processBefore()` for more details.
    if (wrapPrimitives && isArray(value)) {
      value = value.map(object => object[wrapPrimitives])
    }

    clone[name] = value
  }

  return processSchemaData(
    schema, data, dataPath, processBefore, processAfter, shallowClone(data)
  )
}

export function processSchemaData(
  schema,
  data,
  dataPath,
  processBefore,
  processAfter,
  clone
) {
  function processComponents(components) {
    const getDataPath = (dataPath, token) => dataPath != null
      ? appendDataPath(dataPath, token)
      : null

    if (components) {
      for (const [name, componentSchema] of Object.entries(components)) {
        if (isUnnested(componentSchema)) {
          // Recursively process data on unnested components.
          processSchemaData(
            componentSchema,
            data,
            dataPath,
            processBefore,
            processAfter,
            clone
          )
        } else {
          const componentDataPath = getDataPath(dataPath, name)

          const processItem = (item, index = null) => {
            const formSchema = getItemFormSchema(componentSchema, item)
            const itemClone = clone ? shallowClone(item) : null
            return formSchema
              ? processSchemaData(
                formSchema,
                item,
                index !== null
                  ? getDataPath(componentDataPath, index)
                  : componentDataPath,
                processBefore,
                processAfter,
                itemClone
              )
              : itemClone
          }

          processBefore?.(componentSchema, data, name, componentDataPath, clone)
          let value = clone ? clone[name] : data[name]
          if (value != null && hasForms(componentSchema)) {
            // Recursively process data on nested form items.
            if (isArray(value)) {
              // Optimization: No need to collect values if we're not cloning!
              value = clone
                ? value.map(processItem)
                : value.forEach(processItem)
            } else {
              value = processItem(value)
            }
          } else if (clone) {
            value = shallowClone(value)
          }
          if (clone) {
            clone[name] = value
          }
          processAfter?.(componentSchema, data, name, componentDataPath, clone)
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

  return clone || data
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
  return getTypeComponent(getType(schemaOrType))?.options
}

export function getSourceType(schemaOrType) {
  return getTypeOptions(schemaOrType)?.getSourceType?.(
    getType(schemaOrType)
  ) ?? null
}

export function getPanelSchema(schema, dataPath, schemaComponent) {
  // If the schema doesn't represent a type, assume it's a panel schema already
  // (.e.g directly from schema.panels):
  const panel = schema.type
    ? getTypeOptions(schema)?.getPanelSchema?.(
      schema,
      dataPath,
      schemaComponent
    )
    : schema
  return panel
    ? {
      schema: panel,
      // If the panel provides its own name, append it to the dataPath.
      // This is used e.g. for $filters panels.
      dataPath: panel.name
        ? appendDataPath(dataPath, panel.name)
        : dataPath
    }
    : null
}

export function getPanelSchemas(panels, dataPath, schemaComponent) {
  const schemas = []
  if (panels) {
    for (const [key, schema] of Object.entries(panels)) {
      schemas.push(
        getPanelSchema(schema, appendDataPath(dataPath, key), schemaComponent)
      )
    }
  }
  return schemas
}

export function isObjectSource(schemaOrType) {
  return getSourceType(schemaOrType) === 'object'
}

export function isListSource(schemaOrType) {
  return getSourceType(schemaOrType) === 'list'
}

export function getItemId(sourceSchema, item) {
  const id = item[sourceSchema.idName || 'id']
  return id != null ? String(id) : undefined
}

export function getItemUid(sourceSchema, item) {
  // Try to use the item id as the uid, falling back on auto-generated ids, but
  // either way, pass through `getUid()` so that the ids are associated with the
  // item through a weak map, as the ids can be filtered out in `processData()`
  // while the components that use the uids as key are still visible.
  return getUid(item, getItemId(sourceSchema, item))
}
