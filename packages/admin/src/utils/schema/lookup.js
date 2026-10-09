import { appendDataPath } from '../data.js'
import {
  isObject,
  isString,
  isArray,
  isFunction,
  camelize
} from '@ditojs/utils'
import { reactive, computed } from 'vue'
import { getTypeOptions } from './types.js'
import {
  findNestedSchemaComponent,
  isSchema,
  isSingleComponentView
} from './structure.js'
// TODO: Setting up the forms of `components()` callbacks causes the only
// circular import between these modules.
import { setupForm } from './setup.js'

const emptySchema = {}

// The forms with the components that `components()` callbacks create, by
// callback and by the data that they create them for, see
// `getFormWithCreatedComponents()`.
const formsByComponentsCallback = new WeakMap()

export function hasFormSchema(schema) {
  // Support both single form and multiple forms notation, as well as inlined
  // components, also created by `components()` callbacks.
  return (
    isSchema(schema) && (
      isObject(schema.form || schema.forms || schema.components) ||
      isFunction(schema.components)
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
    ? // NOTE: Views can have tabs, in which case the view component is nested
      // in one of the tabs, go find it.
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

export function getViewPath(schema, context) {
  const view = getViewSchema(schema, context)
  if (view) {
    return isSingleComponentView(view)
      ? view.fullPath
      : `${view.fullPath}/${view.path}`
  }
  return null
}

export function getViewEditPath(schema, id, context) {
  const path = getViewPath(schema, context)
  return path ? `${path}/${id}` : null
}

export function getFormSchemas(schema, context, modifyForm) {
  const viewSchema = context && getViewFormSchema(schema, context)
  if (viewSchema) {
    schema = viewSchema
  } else if (schema.view) {
    throw new Error(`Unknown view: '${schema.view}'`)
  }

  let { form, forms } = schema
  if (!form && !forms) {
    const { name, compact, clipboard, tabs, components } = schema
    if (components || tabs) {
      // Convert inlined forms to stand-alone forms, supporting `name`,
      // `compact`, `clipboard`, `tabs` and `components` settings.
      form = { type: 'form', name, compact, clipboard, tabs, components }
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
        form = getFormWithCreatedComponents(form, context)
      }
      return [type, modifyForm?.(form) ?? form]
    })
  )
}

// Returns the form with the components that its `components()` callback
// creates for the data of `context`. The forms are cached per data, and the
// callback only creates new components when the data that it reads changes,
// so that rendering and the walks of the data model, see `DataModel`, share
// the same component schemas. `components()` callbacks therefore derive the
// components from the data of their context, not from its components.
function getFormWithCreatedComponents(form, context) {
  const { item } = context
  if (!isObject(item)) {
    return createFormWithComponents(form, context)
  }
  let formsByItem = formsByComponentsCallback.get(form.components)
  if (!formsByItem) {
    formsByItem = new WeakMap()
    formsByComponentsCallback.set(form.components, formsByItem)
  }
  let entry = formsByItem.get(item)
  if (!entry) {
    entry = { context }
    entry.formWithCreatedComponents = computed(() =>
      createFormWithComponents(form, entry.context)
    )
    formsByItem.set(item, entry)
  }
  // Recreate the components with the latest context rather than the one of
  // the first caller, whose component may have been unmounted since. Changes
  // of the context alone don't recreate them, see above.
  entry.context = context
  return entry.formWithCreatedComponents.value
}

function createFormWithComponents(form, context) {
  // Make the form schema reactive since `setupForm()` is async, so that the
  // setting of defaults will be picked up by downstream code.
  const formWithComponents = reactive({
    ...form,
    components: form.components(context)
  })
  // Process the form again, now that it has its components.
  setupForm(context.api, formWithComponents).catch(console.error)
  return formWithComponents
}

export function getItemFormSchemaFromForms(forms, item) {
  return forms[item?.type] || forms.default || null
}

export function getItemFormSchema(schema, item, context) {
  return (
    getItemFormSchemaFromForms(getFormSchemas(schema, context), item) ||
    // Always return a schema object so we don't need to check for it.
    emptySchema
  )
}

export function isEmptySchema(schema) {
  return schema === emptySchema
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

// Returns the entry of the panel described by `schema`, which `DitoPanels`
// displays at `dataPath` and `componentPath`.
function getPanelEntry(schema, dataPath, componentPath, tabComponent) {
  return schema ? { schema, dataPath, componentPath, tabComponent } : null
}

export function getPanelEntries(
  panelSchemas,
  dataPath,
  componentPath,
  tabComponent = null,
  panelEntries = []
) {
  if (panelSchemas) {
    for (const [key, schema] of Object.entries(panelSchemas)) {
      const entry = getPanelEntry(
        schema,
        appendDataPath(dataPath, key),
        appendDataPath(componentPath, key),
        tabComponent
      )
      if (entry) {
        panelEntries.push(entry)
      }
    }
  }
  return panelEntries
}

// Returns the entries of the panel that the type of the component described by
// `schema` provides, and of the panels in `schema.panels`. The type's panel is
// addressed by its name, e.g. `$filters`, relative to `dataPath` and its
// component path, `dataPathComponentPath`, while the panels in `schema.panels`
// are addressed by their keys, see `getPanelEntries()`, continuing
// `schemaComponentPath`, the component path of `schema` itself, which also
// contains the names of unnested components.
export function getAllPanelEntries(
  api,
  schema,
  dataPath,
  dataPathComponentPath,
  schemaComponentPath,
  component = null,
  tabComponent = null
) {
  const panelSchema = getTypeOptions(schema)?.getPanelSchema?.(
    api,
    schema,
    dataPath,
    component
  )
  const panelEntries = panelSchema
    ? [
        getPanelEntry(
          panelSchema,
          appendDataPath(dataPath, panelSchema.name),
          appendDataPath(dataPathComponentPath, panelSchema.name),
          tabComponent
        )
      ]
    : []
  // Allow each component to provide its own set of panels, in
  // addition to the default one (e.g. getFiltersPanel(), $filters):
  getPanelEntries(
    schema?.panels,
    dataPath,
    schemaComponentPath,
    tabComponent,
    panelEntries
  )
  return panelEntries
}
