import TypeComponent from '@/TypeComponent'
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
    const viewRoute = children.find(
      route => route.component === DitoView && route.path === path
    )
    if (viewRoute) {
      // The view contains a source component that already produced the route
      // for it, see `processSchema.processSchema()`. Just adjust the route to
      // reflect the component's nesting in the view:
      viewRoute.meta.schema = schema
      routes.push(...children)
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

export function processComponent(
  api, schema, name, routes, parentMeta = null, level = 0
) {
  // Delegate schema processing to the actual type components.
  return TypeComponent.get(schema.type)?.options.processSchema?.(
    api, schema, name, routes, parentMeta, level
  )
}

export async function processSchemaComponents(
  api, schema, routes, parentMeta = null, level = 0
) {
  const process = async components => {
    for (const [name, component] of Object.entries(components || {})) {
      await processComponent(api, component, name, routes, parentMeta, level)
    }
  }
  for (const tab of Object.values(schema?.tabs || {})) {
    await process(tab.components, processComponent)
  }
  await process(schema?.components, processComponent)
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
    for (const form of Object.values(forms)) {
      await processSchemaComponents(api, form, children, parentMeta, level + 1)
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
  // When dynamically importing forms, try figuring out and setting their
  // name, if they were declared as named imports:
  if (form && !('components' in form)) {
    const name = Object.keys(form)[0]
    form = form[name]
    if (form && name !== 'default') {
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
  return isObject(schema) && !!(schema.form || schema.forms)
}

export function hasLabels(schema) {
  const check = components => {
    for (const component of Object.values(components || {})) {
      if (component.label !== false) {
        return true
      }
    }
  }
  if (check(schema.components)) {
    return true
  }
  for (const tab of Object.values(schema.tabs || {})) {
    if (check(tab)) {
      return true
    }
  }
  return false
}

export function getPanelSchema(schema) {
  return (
    TypeComponent.get(schema.type)?.options.getPanelSchema?.(schema) ?? null
  )
}

export function shouldRenderLabel(schema) {
  return TypeComponent.get(schema.type)?.options.renderLabel ?? true
}

export function getContainerClass(schema) {
  return TypeComponent.get(schema.type)?.options.containerClass
}

function getSourceType(schemaOrType) {
  // NOTE: `null` is returned for type components that do not define a
  // `getSourceType()` method.
  const type = isObject(schemaOrType) ? schemaOrType.type : schemaOrType
  return TypeComponent.get(type)?.options.getSourceType?.(type) ?? null
}

export function isObjectSource(schemaOrType) {
  return getSourceType(schemaOrType) === 'object'
}

export function isListSource(schemaOrType) {
  return getSourceType(schemaOrType) === 'list'
}
