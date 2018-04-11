import TypeComponent from './TypeComponent'
import DitoView from '@/components/DitoView'
import { isObject, isFunction, isPromise } from '@ditojs/utils'

export async function resolveViews(views) {
  if (isFunction(views)) {
    views = views()
  }
  if (isPromise(views)) {
    views = await views
  }

  return views
}

export async function processView(api, schema, name, routes) {
  if ('type' in schema) {
    // A single-component view
    await processComponent(api, schema, name, routes)
  } else {
    // A multi-component view
    schema.path = schema.path || api.normalizePath(name)
    schema.name = name
    const meta = {
      api,
      schema
    }
    const path = `/${schema.path}`
    const children = []
    await processSchemaComponents(api, schema, children, meta, 0)
    const [route] = children
    if (route?.component === DitoView) {
      // The view contains a list that already produced the route for this view,
      // just adjust it to reflect its nesting in the view:
      route.meta.schema = schema
      route.path = path
      routes.push(route)
    } else {
      routes.push({
        path,
        children,
        component: DitoView,
        meta
      })
    }
  }
}

export function processComponent(api, schema, name, routes,
  parentMeta = null, level = 0) {
  // Delegate processing to the actual type components.
  return TypeComponent.get(schema.type)?.options.processSchema?.(
    api, schema, name, routes, parentMeta, level
  )
}

export function processSchemaComponents(api, schema, routes,
  parentMeta = null, level = 0) {
  const promises = []
  const process = components => {
    for (const [name, component] of Object.entries(components || {})) {
      promises.push(
        processComponent(api, component, name, routes, parentMeta, level)
      )
    }
  }
  for (const tab of Object.values(schema?.tabs || {})) {
    process(tab.components, processComponent)
  }
  process(schema?.components, processComponent)
  return Promise.all(promises)
}

export async function processForms(api, schema, parentMeta, level) {
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
    const promises = Object.values(forms).map(
      form => processSchemaComponents(
        api, form, children, parentMeta, level + 1
      )
    )
    await Promise.all(promises)
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
  // When dynamically importing forms, try figuring out and setting their
  // name, if they were declared as named imports:
  if (form && !form.components) {
    const name = Object.keys(form)[0]
    form = form[name]
    if (name !== 'default') {
      form.name = name
    }
  }
  return form
}

export async function resolveForms(forms) {
  // Basically Promise.props() without bluebird:
  const results = await Promise.all(Object.values(forms).map(resolveForm))
  return Object.keys(forms).reduce(
    (mapped, key, index) => {
      mapped[key] = results[index]
      return mapped
    },
    {}
  )
}

export function hasForms(schema) {
  // Support both single form and multiple forms notation.
  return isObject(schema) && (schema.form || schema.forms)
}

export function isObjectSource(schemaOrType) {
  const type = isObject(schemaOrType) ? schemaOrType.type : schemaOrType
  return !!TypeComponent.get(type)?.options.isObjectSource
}

export function isListSource(schemaOrType) {
  return !isObjectSource(schemaOrType)
}
