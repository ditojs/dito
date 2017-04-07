import Vue from 'vue'
import Router from 'vue-router'
import BaseComponent from './BaseComponent'
import './components'
import './types'
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
  let api = options.api
  let itemEndpoint = '{{ form.endpoint }}/{{ id }}'
  let defaultEndpoints = {
    index: '{{ view.endpoint }}',
    post: '{{ form.endpoint }}',
    get: itemEndpoint,
    put: itemEndpoint,
    delete: itemEndpoint
  }
  let endpoints = api.endpoints || {}
  for (var type in defaultEndpoints) {
    endpoints[type] = getRenderFunction(
        endpoints[type] || defaultEndpoints[type], 'view', 'form', 'id')
  }
  api.endpoints = endpoints

  let views = options.views
  let forms = options.forms
  let routes = []

  for (let name in views) {
    let view = views[name]
    view.endpoint = view.endpoint || name
    let form = forms[view.form]
    let meta = {
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

  register(type, options) {
    return BaseComponent.type(type, options)
  }
}
