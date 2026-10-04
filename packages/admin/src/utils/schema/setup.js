import DitoMixin from '../../mixins/DitoMixin.js'
import TypeMixin from '../../mixins/TypeMixin.js'
import {
  isObject,
  isArray,
  isFunction,
  isPromise,
  isModule,
  camelize,
  assignDeeply,
  mapConcurrently
} from '@ditojs/utils'
import { markRaw } from 'vue'
import { getTypeOptions } from './types.js'
import {
  iterateSchemaComponents,
  iterateNestedSchemaComponents,
  isForm,
  isView,
  isTab,
  isPanel,
  isMenu,
  getSchemaIdentifier,
  getPanelSchemas
} from './structure.js'
import { getFormSchemas } from './lookup.js'

const resolvedSchemas = new WeakMap()

export async function resolveSchema(value, unwrapModule = false) {
  if (resolvedSchemas.has(value)) {
    return resolvedSchemas.get(value)
  }
  let schema = value
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
      // Filter out internal key added by vite / vue 3 plugin when changing
      // code in a dynamically imported vue component, see:
      // https://github.com/vitejs/vite-plugin-vue/blob/abdf5f4f32d02af641e5f60871bde14535569b1e/packages/plugin-vue/src/main.ts#L133
      const keys = Object.keys(schema).filter(key => key !== '_rerender_only')
      if (keys.length === 1) {
        const name = keys[0]
        schema = schema[name]
        if (name !== 'default') {
          schema = { ...schema, name }
        }
      }
    }
  }
  resolvedSchemas.set(value, schema)
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

export async function resolveViews(unresolvedViews) {
  return resolveSchemas(unresolvedViews, async (schema, unwrapModule) => {
    schema = await resolveSchema(schema, unwrapModule)
    if (!schema.name && isMenu(schema)) {
      // Generate a name for sub-menus from their label if it's missing.
      // NOTE: This is never actually referenced from anywhere, but they need
      // a name by which they're stored in the parent object.
      schema = {
        ...schema,
        name: camelize(schema.label),
        items: await resolveSchemas(schema.items)
      }
    }
    return schema
  })
}

export function flattenViews(views) {
  return Object.fromEntries(
    Object.entries(views).reduce(
      (entries, [key, schema]) => {
        if (isMenu(schema)) {
          entries.push(...Object.entries(schema.items))
        } else {
          entries.push([key, schema])
        }
        return entries
      },
      []
    )
  )
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

const processedSchemaDepths = new WeakMap()

export function setupSchemaComponents(
  api,
  schema,
  routes = null,
  level = 0,
  maxDepth = 1
) {
  if (schema) {
    const depth = processedSchemaDepths.get(schema) ?? 0
    if (depth < maxDepth) {
      processedSchemaDepths.set(schema, depth + 1)
      const promises = []
      const process = (component, name, relativeLevel) => {
        promises.push(
          setupSchemaComponent(
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

      return Promise.all(promises)
    }
  }
}

export function setupSchemaComponent(
  api,
  schema,
  name,
  routes = null,
  level = 0
) {
  applySchemaDefaults(api, schema)

  return Promise.all([
    // Also process nested panel schemas.
    mapConcurrently(
      getPanelSchemas(schema),
      panel => setupSchemaComponents(api, panel, routes, level)
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

export async function setupView(component, api, schema, name, fullPath = '') {
  applySchemaDefaults(api, schema)
  setupRouteSchema(api, schema, name, fullPath)
  let children = []
  if (isView(schema)) {
    await setupNestedSchemas(api, schema)
    await setupSchemaComponents(api, schema, children)
  } else if (isMenu(schema)) {
    children = await Promise.all(
      Object.entries(schema.items).map(async ([name, item]) =>
        setupView(component, api, item, name, schema.fullPath)
      )
    )
  } else {
    throw new Error(`Invalid view schema: '${getSchemaIdentifier(schema)}'`)
  }
  return {
    path: schema.fullPath,
    children,
    component,
    meta: {
      api,
      schema
    }
  }
}

export function applySchemaDefaults(api, schema) {
  let defaults = (
    api.defaults[schema.type] ||
    api.defaults[camelize(schema.type)]
  )
  if (defaults) {
    if (isFunction(defaults)) {
      defaults = defaults(schema)
    }
    if (isObject(defaults)) {
      for (const [key, value] of Object.entries(defaults)) {
        if (schema[key] === undefined) {
          schema[key] = value
        } else {
          schema[key] = assignDeeply(schema[key], value)
        }
      }
    }
  }
}

export function applyNestedSchemaDefaults(api, schema) {
  // Process defaults for nested schemas. Note that this is also done when
  // calling `setupSchemaComponents()`, but that function is async, and we
  // need a sync version that only handles the defaults for filters, see
  // `getFiltersPanel()`.
  iterateNestedSchemaComponents(schema, component => {
    applySchemaDefaults(api, component)
    const forms = getFormSchemas(component)
    for (const form of Object.values(forms)) {
      applyNestedSchemaDefaults(api, form)
    }
  })
}

export function setupRouteSchema(api, schema, name, fullPath = null) {
  // Used for view and source schemas, see SourceMixin.
  schema.name ??= name
  schema.path ??= api.normalizePath(name)
  if (fullPath !== null) {
    schema.fullPath = `${fullPath}/${schema.path}`
  }
}

export async function setupForms(api, schema, level) {
  const routes = []
  // First resolve the forms and store the results back on the schema.
  const { form, forms, components, maxDepth = 1 } = schema
  if (forms) {
    schema.forms = await resolveSchemas(forms, form =>
      setupForm(api, form, routes, level, maxDepth)
    )
  } else if (form) {
    schema.form = await setupForm(api, form, routes, level, maxDepth)
  } else if (isObject(components)) {
    // NOTE: Processing forms in computed components is not supported, since it
    // only can be computed in conjunction with actual data.
    const form = {
      type: 'form',
      components
    }
    await setupForm(api, form, routes, level, maxDepth)
  }
  return routes
}

export async function setupForm(
  api,
  schema,
  routes = null,
  level = 0,
  maxDepth = 1
) {
  schema = await resolveSchema(schema, true)
  if (!isForm(schema)) {
    throw new Error(`Invalid form schema: '${getSchemaIdentifier(schema)}'`)
  }
  applySchemaDefaults(api, schema)
  await setupNestedSchemas(api, schema)
  await setupSchemaComponents(api, schema, routes, level, maxDepth)
  return schema
}

export async function setupTab(api, schema) {
  schema = await resolveSchema(schema, true)
  if (!isTab(schema)) {
    throw new Error(`Invalid tab schema: '${getSchemaIdentifier(schema)}'`)
  }
  applySchemaDefaults(api, schema)
  return schema
}

export async function setupPanel(api, schema) {
  schema = await resolveSchema(schema, true)
  if (!isPanel(schema)) {
    throw new Error(`Invalid panel schema: '${getSchemaIdentifier(schema)}'`)
  }
  applySchemaDefaults(api, schema)
  return schema
}

export async function setupNestedSchemas(api, schema) {
  const { tabs, panels } = schema
  if (tabs) {
    schema.tabs = await resolveSchemas(
      tabs,
      tab => setupTab(api, tab)
    )
  }
  if (panels) {
    schema.panels = await resolveSchemas(
      panels,
      panel => setupPanel(api, panel)
    )
  }
}
