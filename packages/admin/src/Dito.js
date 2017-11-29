import Vue from 'vue'
import VueRouter from 'vue-router'
import VeeValidate from 'vee-validate'
import './components'
import './types'
import TypeComponent from './TypeComponent'
import DitoRoot from './components/DitoRoot'
import DitoView from './components/DitoView'
import DitoForm from './components/DitoForm'
import { isFunction, isPromise, hyphenate } from './utils'

Vue.config.productionTip = false
Vue.use(VueRouter)
Vue.use(VeeValidate, {
  // See: https://github.com/logaretm/vee-validate/issues/468
  inject: false,
  // Prefix `errors` and `fields with $ to make it clear they're special props:
  errorBagName: '$errors',
  fieldsBagName: '$fields'
})

const user = {
  role: 'admin' // TODO
}

export async function setup(el, options = {}) {
  const {
    schemas = {},
    settings = {},
    api = {}
  } = options

  const { normalizePath } = api
  api.processPath = isFunction(normalizePath)
    ? normalizePath
    : normalizePath === true
      ? hyphenate
      : val => val

  api.resources = {
    member(component, itemId) {
      return `${component.listSchema.path}/${itemId}`
    },
    collection(component) {
      const { parentFormComponent: parentForm, listSchema } = component
      return parentForm
        ? `${parentForm.listSchema.path}/${parentForm.itemId}/${listSchema.path}`
        : listSchema.path
    },
    ...api.resources
  }

  const routes = []
  const promises = []
  for (const [name, schema] of Object.entries(schemas)) {
    // TODO: Could be other things than lists in the future: add processSchema()
    promises.push(processList(api, schema, name, routes, 0))
  }
  await Promise.all(promises)

  new Vue({
    el,
    router: new VueRouter({
      mode: 'history',
      routes
    }),
    template: '<dito-root :schemas="schemas" :settings="settings" />',
    components: { DitoRoot },
    data: {
      schemas,
      settings
    }
  })
}

async function processList(api, listSchema, name, routes, level) {
  let { form, forms } = listSchema
  // Resolve the forms and store the results back on the schema.
  if (forms) {
    forms = listSchema.forms = await resolveForms(forms)
  } else if (form) {
    form = listSchema.form = await resolveForm(form)
    forms = { default: form } // Only used for processForms() below.
  }
  if (!forms) return
  const path = listSchema.path = listSchema.path || api.processPath(name)
  listSchema.name = name
  const { inline, nested } = listSchema
  const addRoutes = !inline
  if (inline) {
    if (nested === false) {
      throw new Error(
        'Lists with inline forms can only work with nested data')
    }
    listSchema.nested = true
  }
  const root = level === 0
  const childRoutes = forms && await processForms(api, forms, level)
  if (addRoutes) {
    // While root schemas have their own vue route objects, nested lists in
    // forms don't have their own route objects and need their path prefixed.
    const pathPrefix = root ? '' : `${path}/`
    // Use differently named url parameters on each nested level for id as
    // otherwise they would clash and override each other inside $route.params
    // See: https://github.com/vuejs/vue-router/issues/1345
    const param = `id${level + 1}`
    const meta = {
      user,
      api,
      listSchema
    }
    const formRoute = {
      path: `${pathPrefix}:${param}`,
      component: DitoForm,
      children: childRoutes,
      meta: {
        ...meta,
        param
      }
    }
    routes.push(
      root
        ? {
          path: `/${path}`,
          ...(formRoute && {
            children: [formRoute]
          }),
          component: DitoView,
          meta: {
            ...meta,
            schema: listSchema
          }
        }
        // Just redirect back to the form if the user hits a nested list route
        : {
          path,
          redirect: '.'
        },
      // Include the prefixed formRoutes for nested lists.
      ...(!root && formRoute && [formRoute])
    )
  }
}

async function processForms(api, forms, level) {
  const children = []
  const promises = []
  function processComponents(components) {
    for (const [name, component] of Object.entries(components || {})) {
      promises.push(processList(api, component, name, children, level + 1))
    }
  }
  for (const form of Object.values(forms)) {
    for (const tab of Object.values(form.tabs || {})) {
      processComponents(tab.components)
    }
    processComponents(form.components)
  }
  await Promise.all(promises)
  return children
}

async function resolveForm(form) {
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

async function resolveForms(forms) {
  // Basically Promise.props() without bluebird:
  const results = await Promise.all(Object.values(forms).map(resolveForm))
  return Object.keys(forms).reduce((mapped, key, index) => {
    mapped[key] = results[index]
    return mapped
  }, {})
}

export const { register } = TypeComponent

export default {
  setup,
  register
}
