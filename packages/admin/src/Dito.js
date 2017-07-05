import Vue from 'vue'
import VueRouter from 'vue-router'
import VeeValidate from 'vee-validate'
import './components'
import './types'
import DitoComponent from './DitoComponent'
import DitoRoot from './components/DitoRoot'
import DitoView from './components/DitoView'
import DitoForm from './components/DitoForm'
import { hyphenate } from './utils/string'

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
  const normalize = api.normalize || hyphenate

  function addViewRoute(routes, viewDesc, viewName, level) {
    const path = normalize(viewName)
    viewDesc.path = path
    viewDesc.name = viewName
    const formName = viewDesc.form
    const formDesc = viewDesc.formDesc = formName && options.forms[formName]
    const meta = {
      viewDesc,
      user,
      api
    }
    const root = level === 0
    // Root views have their own routes and entries in the breadcrumbs, and the
    // form routes are children of the view route. Nested lists in forms don't
    // have views and routes, so their form routes need the viewName prefixed.
    const formRoutes = formDesc && getFormRoutes(
      root ? '' : `${path}/`,
      formDesc, formName, meta, level
    )

    routes.push(
      root
        ? {
          path: `/${path}`,
          children: formRoutes,
          component: DitoView,
          meta: Object.assign({
            labelDesc: viewDesc
          }, meta)
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
      const desc = components[name]
      if (desc.form && !desc.inline) {
        addViewRoute(routes, desc, name, level)
      }
    }
  }

  function getFormRoutes(pathPrefix, formDesc, formName, meta, level) {
    formDesc.path = normalize(formName)
    formDesc.name = formName
    const children = []
    const tabs = formDesc.tabs
    for (let name in tabs) {
      addViewRoutes(children, tabs[name].components, level + 1)
    }
    addViewRoutes(children, formDesc.components, level + 1)

    // Use differently named url parameters on each nested level for id as
    // otherwise they would clash and override each other inside $route.params
    // See: https://github.com/vuejs/vue-router/issues/1345
    const param = `id${level + 1}`
    return [{
      path: `${pathPrefix}:${param}`,
      component: DitoForm,
      children,
      meta: Object.assign({
        labelDesc: formDesc,
        param
      }, meta)
    }]
  }

  function getEndpoints(endpoints) {
    const defaultEndpoints = {
      member(viewDesc, formDesc, itemId) {
        return `${viewDesc.path}/${itemId}`
      },

      collection(viewDesc, formDesc, parentForm) {
        return parentForm
          ? `${parentForm.viewDesc.path}/${parentForm.itemId}/${viewDesc.path}`
          : viewDesc.path
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
