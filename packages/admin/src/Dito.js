import Vue from 'vue'
import VueRouter from 'vue-router'
import VeeValidate from 'vee-validate'
import './components'
import './types'
import TypeComponent from './TypeComponent'
import DitoRoot from './components/DitoRoot'
import DitoView from './components/DitoView'
import DitoForm from './components/DitoForm'
import {isFunction, hyphenate, camelize} from './utils'

Vue.config.productionTip = false
Vue.use(VueRouter)
Vue.use(VeeValidate, {
  // See: https://github.com/logaretm/vee-validate/issues/468
  inject: false
})

const user = {
  role: 'admin' // TODO
}

export function setup(el, options) {
  const {views, forms, settings, api} = options
  const normalizePath = getNormalizer('path', hyphenate)
  const normalizeName = getNormalizer('name', val => camelize(val, false))

  function getNormalizer(name, defaultFn) {
    const {normalize} = api
    const value = normalize && (name in normalize) ? normalize[name] : normalize
    return isFunction(value) ? value : value === true ? defaultFn : val => val
  }

  function processView(viewSchema, viewName, routes, level) {
    const formName = viewSchema.form
    const formSchema = formName && forms[normalizeName(formName)]
    if (!formSchema) {
      throw new Error(`Form '${formName}' is not defined`)
    }
    const path = normalizePath(viewName)
    viewSchema.path = path
    viewSchema.name = viewName
    viewSchema.formSchema = formSchema
    const meta = {
      viewSchema,
      user,
      api
    }
    const root = level === 0
    // Root views have their own routes and entries in the breadcrumbs, and the
    // form routes are children of the view route. Nested lists in forms don't
    // have views and routes, so their form routes need the viewName prefixed.
    const formRoutes = formSchema &&
      processForm(root ? '' : `${path}/`, formSchema, formName, meta, level)

    routes.push(
      root
        ? {
          path: `/${path}`,
          ...formRoutes.length > 0 && {
            children: formRoutes
          },
          component: DitoView,
          meta: {
            ...meta,
            labelSchema: viewSchema
          }
        }
        // Just redirect back to the form if the user enters a nested list route
        : {
          path,
          redirect: '.'
        },
      // Include the prefixed formRoutes for nested lists.
      ...(!root && formRoutes)
    )
  }

  function processComponents(components, routes, level) {
    for (const name in components) {
      const schema = components[name]
      if (schema.form && !schema.inline) {
        processView(schema, name, routes, level)
      }
    }
  }

  function processForm(pathPrefix, formSchema, formName, meta, level) {
    formSchema.path = normalizePath(formName)
    formSchema.name = formName
    const children = []
    const {tabs} = formSchema
    for (const name in tabs) {
      processComponents(tabs[name].components, children, level + 1)
    }
    processComponents(formSchema.components, children, level + 1)

    // Use differently named url parameters on each nested level for id as
    // otherwise they would clash and override each other inside $route.params
    // See: https://github.com/vuejs/vue-router/issues/1345
    const param = `id${level + 1}`
    return [{
      path: `${pathPrefix}:${param}`,
      component: DitoForm,
      children,
      meta: {
        ...meta,
        labelSchema: formSchema,
        param
      }
    }]
  }

  function getResources(resources) {
    const defaultResources = {
      member(viewSchema, formSchema, parentForm, itemId) {
        return `${viewSchema.path}/${itemId}`
      },

      collection(viewSchema, formSchema, parentForm) {
        return parentForm
          ? `${parentForm.viewSchema.path}/${parentForm.itemId}/${viewSchema.path}`
          : viewSchema.path
      }
    }
    const results = {}
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const entry = resources && resources[method]
      const functions = results[method] = {}
      for (const type in defaultResources) {
        functions[type] = entry && entry[type] || defaultResources[type]
      }
    }
    return results
  }

  api.resources = getResources(api.resources)

  const routes = []

  for (const name in views) {
    processView(views[name], name, routes, 0)
  }

  new Vue({
    el,
    router: new VueRouter({
      mode: 'history',
      routes
    }),
    template: '<dito-root :views="views" :settings="settings" />',
    components: {DitoRoot},
    data: {
      views,
      settings
    }
  })
}

export const {register} = TypeComponent

export default {
  setup,
  register
}
