import Vue from 'vue'
import VueRouter from 'vue-router'
import VeeValidate from 'vee-validate'
import './components'
import './types'
import DitoComponent from './DitoComponent'
import DitoRoot from './components/DitoRoot'
import DitoView from './components/DitoView'
import DitoForm from './components/DitoForm'
import { hyphenate } from './utils'

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
  const api = options.api
  const normalize = api.normalizePath ? hyphenate : val => val

  function addViewRoute(routes, viewSchema, viewName, level) {
    const formName = viewSchema.form
    const formSchema = formName && options.forms[formName]
    const path = normalize(viewName)
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
    const formRoutes = formSchema && getFormRoutes(
      root ? '' : `${path}/`,
      formSchema, formName, meta, level
    )

    routes.push(
      root
        ? {
          path: `/${path}`,
          children: formRoutes,
          component: DitoView,
          meta: {
            ...meta,
            labelSchema: viewSchema
          }
        }
        // Just redirect back to the form if the user enters a nested list route.
        : {
          path: path,
          redirect: '.'
        },
      // Include the prefixed formRoutes for nested lists.
      ...(!root && formRoutes)
    )
  }

  function addViewRoutes(routes, components, level) {
    for (let name in components) {
      const schema = components[name]
      if (schema.form && !schema.inline) {
        addViewRoute(routes, schema, name, level)
      }
    }
  }

  function getFormRoutes(pathPrefix, formSchema, formName, meta, level) {
    formSchema.path = normalize(formName)
    formSchema.name = formName
    const children = []
    const tabs = formSchema.tabs
    for (let name in tabs) {
      addViewRoutes(children, tabs[name].components, level + 1)
    }
    addViewRoutes(children, formSchema.components, level + 1)

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

  function getEndpoints(endpoints) {
    const defaultEndpoints = {
      member(viewSchema, formSchema, itemId) {
        return `${viewSchema.path}/${itemId}`
      },

      collection(viewSchema, formSchema, parentForm) {
        return parentForm
          ? `${parentForm.viewSchema.path}/${parentForm.itemId}/${viewSchema.path}`
          : viewSchema.path
      }
    }
    const results = {}
    for (let method of ['get', 'post', 'put', 'patch', 'delete']) {
      const entry = endpoints && endpoints[method]
      const functions = results[method] = {}
      for (let type in defaultEndpoints) {
        functions[type] = entry && entry[type] || defaultEndpoints[type]
      }
    }
    return results
  }

  api.endpoints = getEndpoints(api.endpoints)

  const views = options.views
  const settings = options.settings
  const routes = []

  for (let name in views) {
    addViewRoute(routes, views[name], name, 0)
  }

  new Vue({
    el: el,
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

export const register = DitoComponent.register

export default {
  setup,
  register
}
