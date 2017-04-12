import Vue from 'vue'
import Router from 'vue-router'
import './components'
import './types'
import TypeComponent from './TypeComponent'
import DitoRoot from './components/DitoRoot'
import DitoView from './components/DitoView'
import DitoForm from './components/DitoForm'
import { compile } from '@/utils/template'

Vue.config.productionTip = false
Vue.use(Router)

function getRenderFunction(value, ...parameters) {
  return value == null
      ? null
      : typeof value === 'function'
        ? value
        : compile(value, ...parameters)
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
    for (let type of ['collection', 'member']) {
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
    const children = []
    const meta = { view, form, api }
    routes.push({
      path: `/${name}`,
      component: DitoView,
      children,
      meta: Object.assign({
        name,
        label: view.label || name // TODO: Capitalize
      }, meta)
    })
    if (form) {
      meta.name = view.form
      form.endpoint = form.endpoint || view.form
      // Use the same route for 'create' and ':id' and have DitoForm handle the
      // separate cases internally.
      children.push({
        path: 'create',
        component: DitoForm,
        meta: Object.assign({
          create: true,
          label: 'Create'
        }, meta)
      }, {
        path: ':id',
        component: DitoForm,
        props: true,
        meta: Object.assign({
          label: 'Edit'
        }, meta)
      })
    }
  }

  new Vue({
    el: el,
    router: new Router({
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
