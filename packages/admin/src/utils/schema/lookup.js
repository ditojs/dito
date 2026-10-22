import { appendDataPath } from '../data.js'
import {
  isObject,
  isString,
  isArray,
  isFunction,
  camelize
} from '@ditojs/utils'
import { reactive, computed, toRaw } from 'vue'
import { getTypeDescriptor } from './types.ts'
import {
  findNestedSchemaComponent,
  isListSource,
  isSchema
} from './structure.js'
import { setupForm } from './setup.js'

const emptySchema = {}

// The forms that `fields()` callbacks create, by callback and by data:
const formsByFieldsCallback = new WeakMap()

export function hasFormSchema(schema) {
  return (
    isSchema(schema) && (
      isObject(schema.form || schema.forms || schema.fields) ||
      isFunction(schema.fields)
    )
  )
}

export function hasMultipleFormSchemas(schema) {
  return (
    isSchema(schema) &&
    Object.keys(schema?.forms || {}).length > 1
  )
}

export function getViewFormSchema(schema, context) {
  const { view } = schema
  const viewSchema = view && context.flattenedViews[view]
  return viewSchema
    ? // NOTE: Views can nest the view component in one of their tabs:
      findNestedSchemaComponent(viewSchema, hasFormSchema) || null
    : null
}

export function getViewSchema(schema, context) {
  return getViewFormSchema(schema, context)
    ? context.flattenedViews[schema.view]
    : null
}

export function hasViewSchema(schema, context) {
  return !!getViewSchema(schema, context)
}

export function getFormSchemas(schema, context, modifyForm) {
  const viewSchema = context && getViewFormSchema(schema, context)
  if (viewSchema) {
    schema = viewSchema
  } else if (schema.view) {
    throw new Error(`Unknown view: '${schema.view}'`)
  }

  let { form, forms } = schema
  // The clipboard of lists copies the whole list, objects are their form:
  const clipboard = !isListSource(schema) && schema.clipboard
  if (!form && !forms) {
    const { type, name, compact, tabs, fields } = schema
    if (fields || tabs) {
      // Convert inlined forms to stand-alone forms. Sections are their form,
      // so it handles their events:
      form = {
        type: 'form',
        name,
        compact,
        tabs,
        fields,
        ...(type === 'section' && getSectionHandlers(schema))
      }
    } else {
      return {}
    }
  }
  forms ||= { default: form }
  return Object.fromEntries(
    Object.entries(forms).map(([type, form]) => {
      // Copy the forms that take the source's clipboard, as other schemas may
      // share them:
      if (clipboard && form.clipboard === undefined) {
        form = { ...form, clipboard }
      }
      if (context && isFunction(form.fields)) {
        form = getFormWithCreatedComponents(form, context)
      }
      return [type, modifyForm?.(form) ?? form]
    })
  )
}

// Cache the forms per data, and only create new components when the data that
// the callback reads changes, so rendering and the walks of the data model
// share the same component schemas.
function getFormWithCreatedComponents(form, context) {
  const { item } = context
  if (!isObject(item)) {
    return createFormWithComponents(form, context)
  }
  let formsByItem = formsByFieldsCallback.get(form.fields)
  if (!formsByItem) {
    formsByItem = new WeakMap()
    formsByFieldsCallback.set(form.fields, formsByItem)
  }
  // Key by the raw item, which contexts may hand out editable:
  let entry = formsByItem.get(toRaw(item))
  if (!entry) {
    entry = { context }
    entry.formWithCreatedComponents = computed(() =>
      createFormWithComponents(form, entry.context)
    )
    formsByItem.set(toRaw(item), entry)
  }
  // Recreate with the latest context, as the first caller's component may have
  // been unmounted since:
  entry.context = context
  return entry.formWithCreatedComponents.value
}

function createFormWithComponents(form, context) {
  // Make the form reactive, as `setupForm()` sets the defaults asynchronously:
  const formWithComponents = reactive({
    ...form,
    fields: form.fields(context)
  })
  setupForm(context.api, formWithComponents).catch(console.error)
  return formWithComponents
}

export function getItemFormSchemaFromForms(forms, item) {
  return forms[item?.type] || forms.default || null
}

export function getItemFormSchema(schema, item, context) {
  return (
    getItemFormSchemaFromForms(getFormSchemas(schema, context), item) ||
    emptySchema
  )
}

export function isEmptySchema(schema) {
  return schema === emptySchema
}

export function getNamedSchemas(schemas, defaults) {
  const toObject = (array, toSchema) =>
    array.length > 0
      ? array.reduce((object, value) => {
          const schema = toSchema(value)
          if (schema) {
            object[schema.name] = defaults ? { ...defaults, ...schema } : schema
          }
          return object
        }, {})
      : null

  return isArray(schemas)
    ? toObject(schemas, value =>
        isObject(value) ? value : { name: camelize(value, false) }
      )
    : isObject(schemas)
      ? toObject(
          Object.entries(schemas),
          ([name, value]) =>
            isObject(value)
              ? value.name === name
                ? value
                : { name, ...value }
              : isString(value)
                ? { name, label: value }
                : null
        )
      : null
}

export function getButtonSchemas(buttons) {
  return getNamedSchemas(buttons, { type: 'button' })
}

// Buttons with `submitsData` save the data, whatever their name:
export function hasSubmitButton(buttons) {
  return Object.values(getButtonSchemas(buttons) ?? {}).some(
    button => !!getTypeDescriptor(button)?.submitsData
  )
}

// Panels of components in tabs are only displayed while their tab is selected,
// which `tab.isTabSelected()` tells:
function getPanelEntry(schema, dataPath, componentPath, tab) {
  return schema
    ? {
        schema,
        dataPath,
        componentPath,
        tabName: tab?.tabName ?? null,
        isTabSelected: tab?.isTabSelected ?? null
      }
    : null
}

export function getPanelEntries(
  panelSchemas,
  dataPath,
  componentPath,
  tab = null,
  panelEntries = []
) {
  if (panelSchemas) {
    for (const [key, schema] of Object.entries(panelSchemas)) {
      const entry = getPanelEntry(
        schema,
        appendDataPath(dataPath, key),
        appendDataPath(componentPath, key),
        tab
      )
      if (entry) {
        panelEntries.push(entry)
      }
    }
  }
  return panelEntries
}

// The type's panel, e.g. `$filters`, is addressed relative to `dataPath`, while
// the panels in `schema.panels` continue the component path of `schema`, which
// also contains the names of unnested components.
export function getAllPanelEntries(
  api,
  schema,
  dataPath,
  dataPathComponentPath,
  schemaComponentPath,
  source = null,
  tab = null
) {
  const panelSchema = getTypeDescriptor(schema)?.getPanelSchema?.(
    api,
    schema,
    dataPath,
    source
  )
  const panelEntries = panelSchema
    ? [
        getPanelEntry(
          panelSchema,
          appendDataPath(dataPath, panelSchema.name),
          appendDataPath(dataPathComponentPath, panelSchema.name),
          tab
        )
      ]
    : []
  getPanelEntries(
    schema?.panels,
    dataPath,
    schemaComponentPath,
    tab,
    panelEntries
  )
  return panelEntries
}

function getSectionHandlers(schema) {
  return Object.fromEntries(
    Object.entries(schema).filter(([key]) => /^on[A-Z]/.test(key))
  )
}
