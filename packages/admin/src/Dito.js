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
    let viewPath = view.mountpoint || name
    let form = forms[view.form]
    routes.push({
      path: `/${name}`,
      component: DitoView,
      meta: {
        name,
        view,
        api,
        path: viewPath
      }
    })
    if (form) {
      let formPath = form.mountpoint || view.form
      // Install separate routes for 'create' and ':id', as they have different
      // API paths: 'create' uses the view path, 'get' the one of the form.
      routes.push({
        path: `/${name}/create`,
        component: DitoForm,
        meta: {
          form,
          api,
          path: viewPath,
          create: true
        }
      }, {
        path: `/${name}/:id`,
        component: DitoForm,
        props: true,
        meta: {
          form,
          api,
          path: formPath
        }
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
    return DitoComponent.type(type, options)
  }
}
