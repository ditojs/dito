import { appendDataPath } from './data'
import { getUid } from './uid'
import {
  isObject, isString, isArray, isFunction, isPromise, asArray, clone, camelize
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

export function forEachSchemaComponent(schema, callback) {
  const schemas = [
    ...Object.values(schema?.tabs || {}),
    schema
  ]
  for (const schema of schemas) {
    for (const [name, component] of Object.entries(schema?.components || {})) {
      const res = callback(component, name)
      if (res !== undefined) {
        return res
      }
    }
  }
}

export function findSchemaComponent(schema, callback) {
  return forEachSchemaComponent(schema, component => {
    if (callback(component)) {
      return component
    }
  }) || null
}

export function someSchemaComponent(schema, callback) {
  return forEachSchemaComponent(schema, component => {
    if (callback(component)) {
      return true
    }
  }) === true
}

export function everySchemaComponent(schema, callback) {
  return forEachSchemaComponent(schema, component => {
    if (!callback(component)) {
      return false
    }
  }) !== false
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
  return view && views[view] || null
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
  return !!getTypeOptions(schema)?.unnested
}

export function getDefaultValue(schema, context = schema) {
  const defaultValue = schema.default
  const value = defaultValue !== undefined
    ? defaultValue
    : getTypeOptions(schema)?.defaultValue
  return isFunction(value)
    ? value(context)
    : clone(value)
}

export function ignoreMissingValue(schema) {
  const type = getType(schema)
  return !!getTypeOptions(type)?.ignoreMissingValue?.(type)
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
  // Sets up a data object that has keys with default values for all
  // form fields, so they can be correctly watched for changes.
  const processComponents = (components = {}) => {
    for (const [key, componentSchema] of Object.entries(components)) {
      if (isUnnested(componentSchema)) {
        // Recursively set defaults on section components.
        setDefaults(componentSchema, data)
      } else {
        // Support default values both on schema and on component level.
        // NOTE: At the time of creation, components may not be instantiated,
        // (e.g. if entries are created through nested forms, the parent form
        // isn't mounted) so we can't use `dataPath` to get to components,
        // and then to the defaultValue from there. That's why defaultValue is
        // a 'static' value on the component definitions:
        if (!(key in data)) {
          data[key] = getDefaultValue(componentSchema)
        }
        if (hasForms(componentSchema)) {
          // Recursively set defaults on nested forms.
          for (const item of asArray(data[key])) {
            const formSchema = getItemFormSchema(componentSchema, item)
            if (item && formSchema) {
              setDefaults(formSchema, item)
            }
          }
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
  return data
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
