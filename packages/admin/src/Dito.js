import Vue from 'vue'
import VueRouter from 'vue-router'
import VueResource from 'vue-resource'
import VeeValidate from 'vee-validate'
import './components'
import './types'
import DitoComponent from './DitoComponent'
import DitoRoot from './components/DitoRoot'
import DitoView from './components/DitoView'
import DitoForm from './components/DitoForm'
import renderLabel from './utils/renderLabel'

Vue.config.productionTip = false
Vue.use(VueRouter)
Vue.use(VueResource)
Vue.use(VeeValidate)

const user = {
  role: 'admin' // TODO
}

function addViewRoute(routes, viewDesc, viewName, options, level) {
  viewDesc.name = viewName
  viewDesc.label = renderLabel(viewDesc, viewName)
  const formName = viewDesc.form
  const formDesc = viewDesc.formDesc = formName && options.forms[formName]
  const meta = {
    viewDesc,
    user,
    api: options.api
  }
  const root = level === 0
  // Root views have their own routes and entries in the breadcrumbs, and the
  // form routes are children of the view route. Nested lists in forms don't
  // have views and routes, so their form routes need the viewName prefixed.
  const formRoutes = formDesc && getFormRoutes(root ? '' : `${viewName}/`,
      formDesc, formName, options, meta, level)
  routes.push(root
    ? {
      path: `/${viewName}`,
      children: formRoutes,
      component: DitoView,
      meta: Object.assign({
        label: viewDesc.label
      }, meta)
    }
    // Just redirect back to the form if the user enters a nested list route.
    : {
      path: viewName,
      redirect: '.'
    },
    // Include the prefixed formRoutes for nested lists.
    ...(!root && formRoutes)
  )
}

function getFormRoutes(routePrefix, formDesc, formName, options, meta, level) {
  formDesc.name = formName
  formDesc.label = renderLabel(formDesc, formName)
  const children = []
  const tabs = formDesc.tabs

  function addRoutes(components) {
    for (let name in components) {
      const desc = components[name]
      if (desc.form && !desc.inline) {
        addViewRoute(children, desc, name, options, level + 1)
      }
    }
  }

  for (let name in tabs) {
    addRoutes(tabs[name].components)
  }
  addRoutes(formDesc.components)

  // We need to use differently named url parameters on each nested level for id
  // as otherwise they would clash and override each other inside $route.params
  // See: https://github.com/vuejs/vue-router/issues/1345
  const param = `id${level + 1}`
  return [{
    path: `${routePrefix}:${param}`,
    component: DitoForm,
    children,
    meta: Object.assign({
      label: formDesc.label,
      param
    }, meta)
  }]
}

function getEndpoints(endpoints) {
  const defaultEndpoints = {
    member(viewDesc, formDesc, id) {
      return `${formDesc.name}/${id}`
    },

    collection(viewDesc, formDesc, parentForm) {
      return parentForm
          ? `${parentForm.name}/${parentForm.id}/${viewDesc.name}`
          : viewDesc.name
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

function setup(el, options) {
  const api = options.api
  api.endpoints = getEndpoints(api.endpoints)

  const views = options.views
  const routes = []
  for (let name in views) {
    addViewRoute(routes, views[name], name, options, 0)
  }

  new Vue({
    el: el,
    router: new VueRouter({
      mode: 'history',
      routes
    }),
    template: '<dito-root :views="views" :settings="settings" />',
    components: { DitoRoot },
    data: {
      views,
      settings: options.settings
    }
  })
}

export default {
  setup,
  register: DitoComponent.register
}
