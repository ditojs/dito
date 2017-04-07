import Vue from 'vue'
import Router from 'vue-router'
import BaseComponent from './BaseComponent'
import './components'
import './types'
import DitoRoot from './components/DitoRoot'
import DitoView from './components/DitoView'
import DitoForm from './components/DitoForm'

Vue.config.productionTip = false
Vue.use(Router)

function setup(el, options) {
  let api = options.api
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
