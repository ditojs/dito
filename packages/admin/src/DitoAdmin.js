import Vue from 'vue'
import VueModal from 'vue-js-modal'
import VueRouter from 'vue-router'
import VueNotifications from 'vue-notification'
import axios from 'axios'
import './components'
import './types'
import './validator'
import verbs from './verbs'
import DitoTypeComponent from './DitoTypeComponent'
import DitoRoot from './components/DitoRoot'
import { hyphenate, camelize, isAbsoluteUrl } from '@ditojs/utils'

Vue.config.productionTip = false

// All global plugins that need to be registered on `Vue`:
Vue.use(VueRouter)
Vue.use(VueModal, {
  dynamic: true
})
Vue.use(VueNotifications)

export default class DitoAdmin {
  constructor(el, {
    dito, // Contains the url and api settings as passed from AdminController
    api = dito?.api || {},
    url = dito?.url || '/',
    views = {},
    ...options
  } = {}) {
    this.el = el
    this.api = api
    this.options = options

    api.request = api.request || ((...args) => this.request(...args))

    // Setting `api.normalizePaths = true (plural) sets both:
    // `api.normalizePath = hyphenate` and `api.denormalizePath = camelize`
    api.normalizePath = api.normalizePath ||
      api.normalizePaths ? hyphenate : val => val
    api.denormalizePath = api.denormalizePath ||
      api.normalizePaths ? camelize : val => val

    // Allow overriding of resource paths:
    // api: {
    //   resources: {
    //     member(component, itemId) {
    //       return `${component.schema.path}/${itemId}`
    //     },
    //     collection(component) {
    //       const { parentFormComponent: parent, sourceSchema } = component
    //       return parent
    //         ? `${sourceSchema.path}?${parent.path}_id=${parent.itemId}`
    //         : sourceSchema.path
    //     }
    //   },
    //   headers: {
    //     'Content-Type': 'application/json'
    //   }
    // }
    api.resources = {
      member(component, itemId) {
        // If itemId is null, then this represents an object source, not a list,
        // (an one-to-one relation on the backend), use the collection endpoint.
        return itemId !== null
          ? `${component.sourceSchema.path}/${itemId}`
          : this.collection(component)
      },

      collection(component) {
        const { parentFormComponent: parent, sourceSchema } = component
        return parent
          ? `${parent.sourceSchema.path}/${parent.itemId}/${sourceSchema.path}`
          : sourceSchema.path
      },

      ...api.resources
    }

    api.headers = {
      'Content-Type': 'application/json',
      ...api.headers
    }

    this.root = new Vue({
      el,
      router: new VueRouter({
        mode: 'history',
        base: url
      }),
      components: { DitoRoot },
      data: {
        views,
        options
      },
      provide: {
        api,
        // A default list of verbs are provided as $verbs, can be overridden at
        // any point in the component hierarchy.
        $verbs: verbs,
        // Placeholder provides so DitoMixin can inject them for all components:
        // inject: [ '$schemaComponent', '$routeComponent' ]
        $schemaComponent: null,
        $routeComponent: null
      },
      render: h => h(DitoRoot, {
        props: {
          views,
          options
        }
      })
    })
  }

  register(type, options) {
    return DitoTypeComponent.register(type, options)
  }

  request({
    url,
    method = 'get',
    data = null,
    params = null,
    headers = null
  }) {
    const isApiRequest = !isAbsoluteUrl(url) || url.startsWith(this.api.url)
    return axios.request({
      url,
      method,
      data: data !== null ? JSON.stringify(data) : null,
      params,
      baseURL: isApiRequest ? this.api.url : null,
      headers: {
        ...(isApiRequest && this.api.headers),
        ...headers
      },
      withCredentials: isApiRequest && !!this.api.cors?.credentials
    })
  }
}
