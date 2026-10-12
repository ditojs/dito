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
import { getTypeDescriptor } from './types.ts'
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
    // Copy to convert the module namespace to a plain object:
    schema = { ...schema }
    // Unwrap default or named schema:
    if (!schema.name && (unwrapModule || schema.default)) {
      // Filter out the key that the vue plugin of vite adds on hot reloads:
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
  // Primitive values, e.g. `undefined`, can't be keys of weak maps:
  if (Object(value) === value) {
    resolvedSchemas.set(value, schema)
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
    // Arrays of dynamic imports of named schema modules become named entries:
    schemas = Object.fromEntries(
      await mapConcurrently(schemas, async item => {
        const schema = await resolveItem(item, true)
        return [schema.name, schema]
      })
    )
  } else if (isObject(schemas)) {
    schemas = Object.fromEntries(
      await mapConcurrently(Object.entries(schemas), async ([key, item]) => [
        key,
        await resolveItem(item, true)
      ])
    )
  }
  return schemas
}

export async function resolveViews(unresolvedViews) {
  const views = await resolveSchemas(
    unresolvedViews,
    async (schema, unwrapModule) => {
      schema = await resolveSchema(schema, unwrapModule)
      if (isMenu(schema)) {
        // NOTE: Sub-menus need a name to be stored by in the parent object:
        const name = schema.name || camelize(schema.label)
        const items = assertSchemas(
          await resolveSchemas(schema.items),
          `items of menu '${name}'`
        )
        schema = { ...schema, name, items }
      }
      return schema
    }
  )
  return assertSchemas(views, 'views')
}

function assertSchemas(schemas, description) {
  if (!isObject(schemas)) {
    throw new Error(`Invalid ${description}: Must be an object or an array.`)
  }
  return schemas
}

export function flattenViews(views) {
  return Object.fromEntries(
    Object.entries(views).flatMap(([key, schema]) =>
      isMenu(schema) ? Object.entries(schema.items) : [[key, schema]]
    )
  )
}

// Resolve async components, e.g. `component: import('./Rating.vue')`:
export async function resolveSchemaComponent(schema) {
  let { component } = schema
  if (component) {
    component = await resolveSchema(component, true)
    if (component) {
      // Prevent Vue's warning about components made reactive objects:
      schema.component = markRaw(component)
    }
  }
}

export async function resolveSchemaComponents(schemas) {
  await mapConcurrently(Object.values(schemas || {}), resolveSchemaComponent)
}

// Set up the components of each schema only once, as forms can contain
// themselves:
const setUpSchemas = new WeakSet()

export function setupSchemaComponents(api, schema) {
  if (schema && !setUpSchemas.has(schema)) {
    setUpSchemas.add(schema)
    const promises = []
    const setupComponent = (component, name) => {
      promises.push(setupSchemaComponent(api, component, name))
    }
    iterateNestedSchemaComponents(schema, setupComponent)
    iterateSchemaComponents(getPanelSchemas(schema), setupComponent)
    return Promise.all(promises)
  }
}

function setupSchemaComponent(api, schema, name) {
  applySchemaDefaults(api, schema)
  return Promise.all([
    mapConcurrently(
      getPanelSchemas(schema),
      panel => setupSchemaComponents(api, panel)
    ),
    getTypeDescriptor(schema)?.setupSchema?.(api, schema, name)
  ])
}

export async function setupView(api, schema, name) {
  applySchemaDefaults(api, schema)
  schema.name ??= name
  if (isView(schema)) {
    await setupNestedSchemas(api, schema)
    await setupSchemaComponents(api, schema)
  } else if (isMenu(schema)) {
    await mapConcurrently(Object.entries(schema.items), ([name, item]) =>
      setupView(api, item, name)
    )
  } else {
    throw new Error(`Invalid view schema: '${getSchemaIdentifier(schema)}'`)
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
  // A sync version of the defaults of `setupSchemaComponents()`, for filters:
  iterateNestedSchemaComponents(schema, component => {
    applySchemaDefaults(api, component)
    const forms = getFormSchemas(component)
    for (const form of Object.values(forms)) {
      applyNestedSchemaDefaults(api, form)
    }
  })
}

export async function setupForms(api, schema) {
  const { form, forms, components } = schema
  if (forms) {
    schema.forms = await resolveSchemas(forms, form => setupForm(api, form))
  } else if (form) {
    schema.form = await setupForm(api, form)
  } else if (isObject(components)) {
    // NOTE: Forms of `components()` callbacks can only be set up with data:
    await setupForm(api, { type: 'form', components })
  }
}

export async function setupForm(api, schema) {
  schema = await resolveSchema(schema, true)
  if (!isForm(schema)) {
    throw new Error(`Invalid form schema: '${getSchemaIdentifier(schema)}'`)
  }
  applySchemaDefaults(api, schema)
  await setupNestedSchemas(api, schema)
  await setupSchemaComponents(api, schema)
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
    schema.tabs = await resolveSchemas(tabs, tab => setupTab(api, tab))
  }
  if (panels) {
    schema.panels = await resolveSchemas(panels, panel =>
      setupPanel(api, panel)
    )
  }
}
