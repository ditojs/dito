import { appendDataPath } from '../data.js'
import {
  isObject,
  isString,
  isArray,
  isFunction,
  camelize
} from '@ditojs/utils'
import { reactive } from 'vue'
import { getTypeOptions } from './types.js'
import {
  findNestedSchemaComponent,
  isSchema,
  isSingleComponentView
} from './structure.js'
// TODO: `getFormSchemas()` processes forms with `components()` callbacks on
// every call, which also causes the only circular import between these
// modules. Move this out of the lookup, see the form model.
import { setupForm } from './setup.js'

const emptySchema = {}

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
        // Make the form schema reactive since `setupForm()` is async, so that
        // the setting of defaults will be picked up by downstream code.
        form = reactive({
          ...form,
          components: form.components(context)
        })
        // Process the form again, now that we have the components.
        setupForm(context.api, form).catch(console.error)
      }
      return [type, modifyForm?.(form) ?? form]
    })
  )
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
  dataPath,
  tabComponent = null,
  panelEntries = []
) {
  if (panelSchemas) {
    for (const [key, schema] of Object.entries(panelSchemas)) {
      const entry = getPanelEntry(
        schema,
        appendDataPath(dataPath, key),
        tabComponent
      )
      if (entry) {
        panelEntries.push(entry)
      }
    }
  }
  return panelEntries
}

export function getAllPanelEntries(
  api,
  schema,
  dataPath,
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
    ? [getPanelEntry(panelSchema, dataPath, tabComponent)]
    : []
  // Allow each component to provide its own set of panels, in
  // addition to the default one (e.g. getFiltersPanel(), $filters):
  getPanelEntries(schema?.panels, dataPath, tabComponent, panelEntries)
  return panelEntries
}
