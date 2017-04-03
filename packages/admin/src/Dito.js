import Vue from 'vue'
import Router from 'vue-router'
import DitoComponent from './DitoComponent'
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
    routes.push({
      path: name,
      component: DitoView,
      meta: {
        name,
        view,
        path: view.mountpoint || name,
        api: api
      }
    })
    let form = forms[view.form]
    if (form) {
      // Install one route per form that handles both /:id and /create:
      routes.push({
        path: `${name}/:param`,
        component: DitoForm,
        props: true,
        meta: {
          form,
          path: view.mountpoint || view.form,
          api: api
        }
      })
    }
  }

  let router = new Router({
    mode: 'history',
    routes: [{
      path: '/',
      component: DitoRoot,
      meta: {
        views
      },
      children: routes
    }]
  })

  new Vue({
    el: el,
    router,
    template: '<router-view/>'
  })
}

export default {
  setup,
  register: DitoComponent.type
}
