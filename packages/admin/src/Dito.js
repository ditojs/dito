import Vue from 'vue'
import VueRouter from 'vue-router'
import VueResource from 'vue-resource'
import './components'
import './types'
import TypeComponent from './TypeComponent'
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

function addFormRoutes(routes, routeName, form, formName, forms, meta) {
  form.endpoint = form.endpoint || formName
  const children = []
  const tabs = form.tabs
  for (let name in tabs) {
    addComponentsRoutes(children, tabs[name].components, forms, meta)
  }
  addComponentsRoutes(children, form.components, forms, meta)
  // Use the same route for 'create' and ':id' and have DitoForm handle the
  // separate cases internally.
  const label = renderLabel(form, formName)
  routes.push({
    path: routeName ? `${routeName}/create` : 'create',
    component: DitoForm,
    meta: Object.assign({
      name: formName,
      label: `Create ${label}`,
      create: true,
      form
    }, meta)
  }, {
    path: routeName ? `${routeName}/:id` : ':id',
    component: DitoForm,
    props: true,
    children,
    meta: Object.assign({
      name: formName,
      label: `Edit ${label}`,
      form
    }, meta)
  })
  return routes
}

function addComponentsRoutes(routes, components, forms, meta) {
  for (let name in components) {
    const desc = components[name]
    const formName = desc.form
    if (formName && !desc.inline) {
      const form = forms[formName]
      if (form) {
        addFormRoutes(routes, name, form, formName, forms, meta)
      }
    }
  }
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
  const forms = options.forms
  const routes = []

  for (let name in views) {
    const view = views[name]
    view.endpoint = view.endpoint || name
    const form = forms[view.form]
    const meta = { view, api, user }
    routes.push({
      path: `/${name}`,
      component: DitoView,
      children: form && addFormRoutes([], null, form, view.form, forms, meta),
      meta: Object.assign({
        name,
        label: renderLabel(view, name),
        form
      }, meta)
    })
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
  register: TypeComponent.register
}
