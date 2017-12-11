import TypeComponent from './TypeComponent'
import { isFunction, isPromise } from './utils'

export async function processComponent(schema, name, api, routes, parentMeta,
  level) {
  // Delegate processing to the actual type components.
  return TypeComponent.get(schema.type)?.options.processSchema?.(
    schema, name, api, routes, parentMeta, level)
}

export async function processForms(schema, api, parentMeta, level) {
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
    const promises = []
    const processComponents = components => {
      for (const [name, component] of Object.entries(components || {})) {
        promises.push(
          processComponent(component, name, api, children, parentMeta,
            level + 1))
      }
    }
    for (const form of Object.values(forms)) {
      for (const tab of Object.values(form.tabs || {})) {
        processComponents(tab.components)
      }
      processComponents(form.components)
    }
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
  return Object.keys(forms).reduce((mapped, key, index) => {
    mapped[key] = results[index]
    return mapped
  }, {})
}
