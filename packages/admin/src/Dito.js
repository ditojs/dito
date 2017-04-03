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
  let routes = []
  let views = options.views
  let forms = options.forms

  for (let name in views) {
    let view = views[name]
    routes.push({
      path: name,
      name: name,
      component: DitoView,
      meta: view
    })
    let form = forms[view.form]
    if (form) {
      routes.push({
        path: `${name}/:param`,
        component: DitoForm,
        meta: form
      })
    }
  }

  let router = new Router({
    mode: 'history',
    routes: [{
      path: '/',
      component: DitoRoot,
      meta: views,
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
