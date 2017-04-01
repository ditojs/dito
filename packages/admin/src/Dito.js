import Vue from 'vue'
import Router from 'vue-router'
import DitoComponent from './DitoComponent'
import DitoRoot from './DitoRoot'
import DitoView from './DitoView'
import DitoForm from './DitoForm'

Vue.config.productionTip = false
Vue.use(Router)

let schemas = {
  Root: {
    addresses: {
      type: 'list',
      model: 'Address',
      label: 'Addresses'
    },

    users: {
      type: 'list',
      model: 'User',
      label: 'Users'
    }
  },

  Address: {
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
  }
}

let routes = []

for (let name in schemas.Root) {
  let desc = schemas.Root[name]
  routes.push({
    path: name,
    name: name,
    component: DitoView,
    meta: desc
  })
  let schema = schemas[desc.model]
  if (schema) {
    routes.push({
      path: `${name}/create`,
      component: DitoForm,
      meta: schema
    }, {
      path: `${name}/:id`,
      component: DitoForm,
      meta: schema
    })
  }
}

let router = new Router({
  mode: 'history',
  routes: [{
    path: '/',
    component: DitoRoot,
    meta: schemas.Root,
    children: routes
  }]
})

export default {
  setup(el) {
    new Vue({
      el: el,
      router,
      template: '<router-view/>'
    })
  },

  register: DitoComponent.register
}
