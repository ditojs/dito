import {
  isObject,
  isPlainObject,
  isArray,
  isFunction,
  isPromise,
  isModule,
  camelize,
  assignDeeply,
  mapConcurrently,
  getValueAtDataPath
} from '@ditojs/utils'
import { markRaw } from 'vue'
import { getTypeDescriptor } from './types.ts'
import {
  iterateSchemaComponents,
  iterateNestedSchemaComponents,
  isForm,
  isView,
  isPage,
  isTab,
  isPanel,
  isPanelWithOwnData,
  isMenu,
  getSchemaIdentifier,
  getPanelSchemas
} from './structure.js'
import { getFormSchemas } from './lookup.js'
import { checkFormProperties } from './properties.js'
import { getText } from '../html.js'

const resolvedSchemas = new WeakMap()

// Lists and objects don't toggle, the inlined forms of their items do:
const onToggle = `'onToggle()', or 'form: { onToggle() }' in lists and objects,`

// The schema keys that 4.0 renamed or removed, which would otherwise be ignored
// silently:
const removedSchemaKeys = {
  format: `'formatValue()'`,
  parse: `'parseValue()'`,
  compute: `'computeValue()'`,
  process: `'serializeValue()'`,
  methods: 'plain functions in the module of the schema',
  computed: `the values of the context, or 'computeValue()'`,
  watch: `'onChange()'`,
  data: 'state in the module of the schema',
  relateBy: `'relate: <key>'`,
  groupBy: `'options.group'`,
  onOpen: onToggle
}

// The events of forms that `onSuccess()` replaces:
const onSuccess = `'onSuccess()' with 'context.isCreating'`
const removedFormKeys = {
  onCreate: onSuccess,
  onSubmit: onSuccess
}

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
        const name = schema.name || camelize(getText(schema.label))
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

export async function setupSchemaComponent(api, schema, name) {
  applySchemaDefaults(api, schema, name)
  schema.name ??= name
  await setupNestedSchemas(api, schema)
  await Promise.all([
    mapConcurrently(
      getPanelSchemas(schema),
      panel => setupSchemaComponents(api, panel)
    ),
    getTypeDescriptor(schema)?.setupSchema?.({ schema, api, name })
  ])
}

export async function setupView(api, schema, name) {
  applySchemaDefaults(api, schema, name)
  schema.name ??= name
  if (isView(schema)) {
    await setupNestedSchemas(api, schema)
    await setupSchemaComponents(api, schema)
  } else if (isPage(schema)) {
    await resolveSchemaComponent(schema)
  } else if (isMenu(schema)) {
    await mapConcurrently(Object.entries(schema.items), ([name, item]) =>
      setupView(api, item, name)
    )
  } else {
    throw new Error(`Invalid view schema: '${getSchemaIdentifier(schema)}'`)
  }
}

export function applySchemaDefaults(api, schema, name = schema.name) {
  let defaults = (
    api.defaults[schema.type] ||
    api.defaults[camelize(schema.type)]
  )
  if (defaults) {
    // The values that functions return win over the schema's, e.g. to change
    // its type, while the schema's own values win over object defaults:
    const isCallback = isFunction(defaults)
    if (isCallback) {
      defaults = defaults(schema)
    }
    if (isObject(defaults)) {
      for (const [key, value] of Object.entries(defaults)) {
        const current = schema[key]
        schema[key] =
          current === undefined
            ? value
            : isCallback
              ? assignDeeply(current, value)
              : isPlainObject(current) && isPlainObject(value)
                ? assignDeeply({}, value, current)
                : current
      }
    }
  }
  // Check after the defaults, which can change the type and add keys:
  assertSupportedSchemaKeys(schema, name)
  // Buttons are schemas but no components. Those without a type only get it
  // when rendered, merged with the default buttons:
  for (const buttons of [schema.buttons, schema.panelButtons]) {
    for (const [key, button] of Object.entries(buttons ?? {})) {
      if (isObject(button)) {
        applySchemaDefaults(api, button, button.name ?? key)
      }
    }
  }
}

export function applyNestedSchemaDefaults(api, schema) {
  // A sync version of the defaults of `setupSchemaComponents()`, for filters:
  iterateNestedSchemaComponents(schema, (component, name) => {
    applySchemaDefaults(api, component, name)
    const forms = getFormSchemas(component)
    for (const form of Object.values(forms)) {
      applyNestedSchemaDefaults(api, form)
    }
  })
}

export async function setupForms(api, schema) {
  const { form, forms, fields } = schema
  if (forms) {
    schema.forms = await resolveSchemas(forms, form => setupForm(api, form))
  } else if (form) {
    schema.form = await setupForm(api, form)
  } else if (isObject(fields)) {
    // NOTE: Forms of `fields()` callbacks can only be set up with data:
    await setupForm(api, { type: 'form', fields })
  }
}

export async function setupForm(api, schema) {
  schema = await resolveSchema(schema, true)
  if (!isForm(schema)) {
    throw new Error(`Invalid form schema: '${getSchemaIdentifier(schema)}'`)
  }
  applySchemaDefaults(api, schema)
  checkFormProperties(schema)
  if (schema.component && !schema.fields && !schema.properties) {
    throw new Error(
      `Invalid form schema: 'component' needs 'fields' or 'properties'.`
    )
  }
  await Promise.all([
    resolveSchemaComponent(schema),
    setupNestedSchemas(api, schema)
  ])
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
    schema.tabs = nameSchemas(
      await resolveSchemas(tabs, tab => setupTab(api, tab))
    )
  }
  if (panels) {
    schema.panels = nameSchemas(
      await resolveSchemas(panels, panel => setupPanel(api, panel))
    )
  }
}

// Name the schemas by their keys, like components, unless they have a name:
function nameSchemas(schemas) {
  for (const [name, schema] of Object.entries(schemas)) {
    schema.name ??= name
  }
  return schemas
}

function assertSupportedSchemaKeys(schema, name) {
  const descriptor = getTypeDescriptor(schema)
  assertRemovedSchemaKeys(schema, name, removedSchemaKeys, {
    // The value hooks of 3.x are callbacks, other values aren't checked:
    format: !isFunction(schema.format),
    parse: !isFunction(schema.parse),
    compute: !isFunction(schema.compute),
    process: !isFunction(schema.process),
    data: isPanel(schema) || !!descriptor?.resolvesValue
  })
  if (isForm(schema)) {
    assertRemovedSchemaKeys(schema, name, removedFormKeys)
  }
  // Other types ignore `search`, so we only warn about it:
  if (schema.search !== undefined && !descriptor?.hasSearch) {
    console.warn(
      `Unsupported schema key 'search' in '${
        name ?? schema.type
      }' is ignored: Only multiselects support it.`
    )
  }
  // Only types that don't nest their data by default can choose to:
  if (schema.nested !== undefined && descriptor?.defaultNested) {
    throw new Error(
      `Unsupported schema key 'nested' in '${
        name ?? schema.type
      }': Only sections and panels support it.`
    )
  }
  // Panels with their own data don't hold it in the data around them:
  if (isPanelWithOwnData(schema) && schema.nested) {
    throw new Error(
      `Unsupported schema key 'nested' in '${
        name ?? schema.type
      }': Panels with their own data can't be nested.`
    )
  }
}

// Types also check the keys that only they removed:
export function assertRemovedSchemaKeys(
  schema,
  name,
  removedKeys,
  supportedKeys = {}
) {
  for (const [key, replacement] of Object.entries(removedKeys)) {
    if (
      getValueAtDataPath(schema, key, () => undefined) !== undefined &&
      !supportedKeys[key]
    ) {
      throw new Error(
        `Unsupported schema key '${key}' in '${
          name ?? schema.type
        }': Use ${replacement} instead.`
      )
    }
  }
}
