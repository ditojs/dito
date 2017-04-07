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
  const itemEndpoint = '{{ form.endpoint }}/{{ id }}'
  const defaultEndpoints = {
    index: '{{ view.endpoint }}',
    post: '{{ form.endpoint }}',
    get: itemEndpoint,
    put: itemEndpoint,
    delete: itemEndpoint
  }
  const endpoints = api.endpoints || {}
  for (let type in defaultEndpoints) {
    endpoints[type] = getRenderFunction(
        endpoints[type] || defaultEndpoints[type], 'view', 'form', 'id')
  }
  api.endpoints = endpoints

  const views = options.views
  const forms = options.forms
  const routes = []

  for (let name in views) {
    const view = views[name]
    view.endpoint = view.endpoint || name
    const form = forms[view.form]
    const meta = {
      name,
      view,
      form,
      api
    }
    routes.push({
      path: `/${name}`,
      component: DitoView,
      meta: meta
    })
    if (form) {
      form.endpoint = form.endpoint || view.form
      // Use the same route for 'create' and ':id' and have DitoForm handle the
      // separate cases internally.
      routes.push({
        path: `/${name}/:param`,
        component: DitoForm,
        props: true,
        meta: meta
      })
    }
  }

  new Vue({
    el: el,
    router: new Router({
      mode: 'history',
      routes
    }),
    template: '<dito-root :views="views"/>',
    components: { DitoRoot },
    data: { views }
  })
}

export default {
  setup,
  register: TypeComponent.register
}
