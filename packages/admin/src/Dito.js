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

let views = {
  addresses: {
    // default: ${baseUrl}/${name}
    // endpoint: '/admin/addresses',
    type: 'list',
    form: 'address',
    label: 'Addresses'
  },

  users: {
    type: 'list',
    form: 'user',
    label: 'Users'
  }
}

let forms = {
  address: {
    // default: ${baseUrl}/${name}
    // endpoint: '/admin/address',

    first_name: {
      type: 'text',
      label: 'First Name',
      value: 'Ditte'
    },

    last_name: {
      type: 'text',
      label: 'Last Name',
      value: 'Staun'
    }
  },

  license_field: {
    // STI-ish base schema
    endpoint: '/admin/license_fields'
  },

  // STI-ish
  text_field: {
    base: 'license_field'
  },

  date_field: {
    base: 'license_field'
  }
}

let routes = []

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

export default {
  setup(el, options) {
    new Vue({
      el: el,
      router,
      template: '<router-view/>'
    })
  },

  register: DitoComponent.type
}
