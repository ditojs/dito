import Vue from 'vue'
import VueRouter from 'vue-router'
import VeeValidate from 'vee-validate'
import axios from 'axios'
import './components'
import './types'
import DitoComponent from './DitoComponent'
import TypeComponent from './TypeComponent'
import DitoRoot from './components/DitoRoot'
import { hyphenate, camelize } from '@ditojs/utils'

Vue.config.productionTip = false
Vue.use(VueRouter)
Vue.use(VeeValidate, {
  // See: https://github.com/logaretm/vee-validate/issues/468
  inject: false,
  // Prefix `errors` and `fields with $ to make it clear they're special props:
  errorBagName: '$errors',
  fieldsBagName: '$fields'
})

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

    this.root = new DitoComponent({
      el,
      router: new VueRouter({
        mode: 'history',
        base
      }),
      template: '<dito-root :meta="meta" :views="views" :options="options" />',
      components: { DitoRoot },
      data: {
        meta: { api },
        views,
        options
      }
    })
  }

  register(type, options) {
    return TypeComponent.register(type, options)
  }

  request({ method, url, data, params }) {
    return axios.request({
      url,
      method,
      data: data != null ? JSON.stringify(data) : null,
      params,
      baseURL: this.api.url,
      headers: this.api.headers || {
        'Content-Type': 'application/json'
      },
      withCredentials: !!this.api.cors?.credentials
    })
  }
}
