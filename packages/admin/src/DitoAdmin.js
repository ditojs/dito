import Vue from 'vue'
import VueModal from 'vue-js-modal'
import VueRouter from 'vue-router'
import VueNotifications from 'vue-notification'
import VeeValidate from 'vee-validate'
import axios from 'axios'
import './components'
import './types'
import TypeComponent from './TypeComponent'
import DitoRoot from './components/DitoRoot'
import { hyphenate, camelize } from '@ditojs/utils'

Vue.config.productionTip = false

// All global plugins that need to be registered on `Vue`:
Vue.use(VueRouter)
Vue.use(VeeValidate, {
  // See: https://github.com/logaretm/vee-validate/issues/468
  inject: false,
  // Prefix `errors` and `fields with $ to make it clear they're special props:
  errorBagName: '$errors',
  fieldsBagName: '$fields'
})
Vue.use(VueModal, {
  dynamic: true
})
Vue.use(VueNotifications)

export default class DitoAdmin {
  constructor(el, { api = {}, base = '/', views = {}, ...options } = {}) {
    this.el = el
    this.api = api
    this.options = options

    api.request = api.request || ((...args) => this.request(...args))

    // Setting `api.normalizePaths = true (plural) sets both:
    // `api.normalizePath = hyphenate` and `api.denormalizePath = camelize`
    api.normalizePath = api.normalizePath ||
      api.normalizePaths === true ? hyphenate : val => val
    api.denormalizePath = api.denormalizePath ||
      api.normalizePaths === true ? camelize : val => val

    // Allow overriding of resource paths:
    // api: {
    //   resources: {
    //     member(component, itemId) {
    //       return `${component.schema.path}/${itemId}`
    //     },
    //     collection(component) {
    //       const { parentFormComponent: parent, listSchema } = component
    //       return parent
    //         ? `${listSchema.path}?${parent.path}_id=${parent.itemId}`
    //         : listSchema.path
    //     }
    //   },
    //   headers: {
    //     'Content-Type': 'application/json'
    //   }
    // }
    api.resources = {
      member(component, itemId) {
        return `${component.listSchema.path}/${itemId}`
      },
      collection(component) {
        const { parentFormComponent: parent, listSchema } = component
        return parent
          ? `${parent.listSchema.path}/${parent.itemId}/${listSchema.path}`
          : listSchema.path
      },
      ...api.resources
    }

    this.root = new Vue({
      el,
      router: new VueRouter({
        mode: 'history',
        base
      }),
      template: '<dito-root :views="views" :options="options" />',
      components: { DitoRoot },
      provide: {
        api
      },
      data: {
        views,
        options
      }
    })
  }

  register(type, options) {
    return TypeComponent.register(type, options)
  }

  request({
    url,
    method = 'get',
    data = null,
    params = null,
    headers = null
  }) {
    return axios.request({
      url,
      method,
      data: data !== null ? JSON.stringify(data) : null,
      params,
      baseURL: this.api.url,
      headers: {
        'Content-Type': 'application/json',
        ...this.api.headers,
        ...headers
      },
      withCredentials: !!this.api.cors?.credentials
    })
  }
}
