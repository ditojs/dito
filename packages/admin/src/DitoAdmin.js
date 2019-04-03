import Vue from 'vue'
import VueModal from 'vue-js-modal'
import VueRouter from 'vue-router'
import VueNotifications from 'vue-notification'
import axios from 'axios'
import './components'
import './types'
import './validator'
import verbs from './verbs'
import TypeComponent from './TypeComponent'
import DitoRoot from './components/DitoRoot'
import { getResource, getNestedResource } from './utils/resource'
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

    api.locale = api.locale || 'en-US'
    // Allow the configuration of all auth resources, like so:
    // api.auth = {
    //   path: 'admins',
    //   // These are the defaults:
    //   login: {
    //     path: 'login',
    //     method: 'post'
    //   },
    //   logout: {
    //     path: 'logout',
    //     method: 'post'
    //   },
    //   session: {
    //     path: 'session',
    //     method: 'get'
    //   },
    //   users: {
    //     path: '..',
    //     method: 'get'
    //   }
    // }
    const auth = api.auth = getResource(api.auth) || {}
    auth.users = getNestedResource(auth.users || '..', auth, 'get')
    auth.login = getNestedResource(auth.login || 'login', auth, 'post')
    auth.logout = getNestedResource(auth.logout || 'logout', auth, 'post')
    auth.session = getNestedResource(auth.session || 'session', auth, 'get')

    api.request = api.request || ((...args) => this.request(...args))

    // Setting `api.normalizePaths = true (plural) sets both:
    // `api.normalizePath = hyphenate` and `api.denormalizePath = camelize`
    api.normalizePath = api.normalizePath ||
      api.normalizePaths ? hyphenate : val => val
    api.denormalizePath = api.denormalizePath ||
      api.normalizePaths ? camelize : val => val

    // Allow overriding of resource paths:
    // api.resourcePath = {
    //   collection(resource) {
    //     return resource.parent
    //       ? `${resource.path}?${resource.parent.path}_id=${
    //          resource.parent.id}`
    //       : resource.path
    //   }
    // }

    api.resourcePath = {
      default(resource) {
        const parentPath = api.getResourcePath(resource.parent)
        return parentPath
          ? `${parentPath}/${resource.path}`
          : resource.path
      },

      // NOTE: collection() is handled by default()

      member(resource) {
        // NOTE: We assume that all members have root-level collection routes,
        // to avoid excessive nesting of (sub-)collection routes.
        return `${resource.parent.path}/${resource.id}`
      },

      upload(resource) {
        // Dito Server handles upload routes on the collection resource,
        // which is the parent of the member resource:
        const { parent } = resource
        const collection = parent.type === 'member' ? parent.parent : parent
        return `${api.getResourcePath(collection)}/upload/${resource.path}`
      },

      ...api.resourcePath
    }

    api.getResourcePath = api.getResourcePath || (resource => {
      const handlers = api.resourcePath
      const handler = handlers[resource?.type] || handlers.default
      return resource && handler(resource)
    })

    // Allow overriding / extending of headers:
    // api.headers = {
    //   'Content-Type': 'application/json'
    // }
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
    return TypeComponent.register(type, options)
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
