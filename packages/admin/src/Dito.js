import Vue from 'vue'
import VueRouter from 'vue-router'
import VueResource from 'vue-resource'
import './components'
import './types'
import DitoComponent from './DitoComponent'
import DitoRoot from './components/DitoRoot'
import DitoView from './components/DitoView'
import DitoForm from './components/DitoForm'
import { compile } from './utils/template'
import renderLabel from './utils/renderLabel'

Vue.config.productionTip = false
Vue.use(VueRouter)
Vue.use(VueResource)

function getRenderFunction(value, ...parameters) {
  return value == null
      ? null
      : typeof value === 'function'
        ? value
        : compile(value, ...parameters)
}

const user = {
  role: 'admin' // TODO
}

function addViewRoute(routes, view, viewName, options, root) {
  view.name = viewName
  view.endpoint = view.endpoint || viewName
  view.label = renderLabel(view, viewName)
  const formName = view.form
  const form = view.form = formName && options.forms[formName]
  const meta = {
    view,
    user,
    api: options.api
  }
  // Root views have their own routes and entries in the breadcrumbs, and the
  // form routes are children of the view route. Nested lists in forms don't
  // have views and routes, so their form routes need the viewName prefixed.
  const formRoutes = form && getFormRoutes(root ? '' : `${viewName}/`,
      form, formName, options, meta)
  routes.push(root
    ? {
      path: `/${viewName}`,
      children: formRoutes,
      component: DitoView,
      meta: Object.assign({
        name: viewName,
        label: view.label
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

function getFormRoutes(routePrefix, form, formName, options, meta) {
  form.name = formName
  form.endpoint = form.endpoint || formName
  form.label = renderLabel(form, formName)
  const children = []
  const tabs = form.tabs

  function addRoutes(components) {
    for (let name in components) {
      const desc = components[name]
      if (desc.form && !desc.inline) {
        addViewRoute(children, desc, name, options, false)
      }
    }
  }

  for (let name in tabs) {
    addRoutes(tabs[name].components)
  }
  addRoutes(form.components)

  return [{
    path: `${routePrefix}create`,
    component: DitoForm,
    meta: Object.assign({
      name: formName,
      label: `Create ${form.label}`,
      create: true
    }, meta)
  }, {
    path: `${routePrefix}:id`,
    component: DitoForm,
    children,
    meta: Object.assign({
      name: formName,
      label: `Edit ${form.label}`
    }, meta)
  }]
}

function setup(el, options) {
  const api = options.api
  const defaultEndpoints = {
    collection: '{{ view.endpoint }}',
    member: '{{ form.endpoint }}/{{ id }}'
  }
  const endpoints = api.endpoints || {}
  for (let method of ['post', 'get', 'put', 'delete']) {
    const entry = endpoints[method]
    const functions = endpoints[method] = {}
    for (let type in defaultEndpoints) {
      functions[type] = getRenderFunction(
          entry && entry[type] || defaultEndpoints[type],
          'view', 'form', 'id')
    }
  }
  api.endpoints = endpoints

  const views = options.views
  const routes = []
  for (let name in views) {
    addViewRoute(routes, views[name], name, options, true)
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
