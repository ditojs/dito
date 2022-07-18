import Vue from 'vue'
import VueModal from 'vue-js-modal'
import VueRouter from 'vue-router'
import VueNotifications from 'vue-notification'
import axios from 'axios'
import {
  isString, isAbsoluteUrl, merge, hyphenate, camelize, defaultFormats
} from '@ditojs/utils'
import * as components from './components/index.js'
import * as types from './types/index.js'
import DitoRoot from './components/DitoRoot.vue'
import TypeComponent from './TypeComponent.js'
import { getResource } from './utils/resource.js'
import verbs from './verbs.js'

Vue.config.productionTip = false

// All global plugins that need to be registered on `Vue`:
Vue.use(VueRouter)
Vue.use(VueModal, { dynamic: true })
Vue.use(VueNotifications)

export default class DitoAdmin {
  constructor(el, {
    // `dito` contains the base and api settings passed from `AdminController`
    dito = {},
    api,
    views = {},
    ...options
  } = {}) {
    this.el = el
    // Merge in `api` settings as passed from `config.admin` and through the
    // `AdminController` with `api` values from from 'admin/index.js'
    // NOTE: `AdminController` provides `dito.api.base`
    this.api = api = merge({ base: '/' }, dito.api, api)
    this.options = options

    // Setup default api setttings:
    api.locale ||= 'en-US'

    api.formats = merge({}, defaultFormats, api.formats)

    api.request ||= options => this.request(options)

    // Setting `api.normalizePaths = true (plural) sets both:
    // `api.normalizePath = hyphenate` and `api.denormalizePath = camelize`
    api.normalizePath = (
      api.normalizePath ||
      api.normalizePaths
        ? hyphenate
        : val => val
    )
    api.denormalizePath = (
      api.denormalizePath ||
      api.normalizePaths
        ? camelize
        : val => val
    )

    // Allow the configuration of all auth resources, like so:
    // api.users = {
    //   path: '/admins',
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
    //   }
    // }
    const users = api.users = getResource(api.users, {
      type: 'collection'
    }) || {}
    users.login = getResource(users.login || 'login', {
      method: 'post',
      parent: users
    })
    users.logout = getResource(users.logout || 'logout', {
      method: 'post',
      parent: users
    })
    users.session = getResource(users.session || 'session', {
      method: 'get',
      parent: users
    })

    // Allow overriding of resource path handlers:
    // api.resources = {
    //   collection(resource) {
    //     return resource.parent
    //       ? `${resource.path}?${resource.parent.path}_id=${
    //          resource.parent.id}`
    //       : resource.path
    //   }
    // }

    api.resources = {
      any(resource) {
        const handler = this[resource?.type] || this.default
        return resource && handler.call(this, resource)
      },

      default(resource) {
        const parentPath = this.any(resource.parent)
        return parentPath
          ? `${parentPath}/${resource.path}`
          : resource.path
      },

      collection(resource) {
        return this.default(resource)
      },

      member(resource) {
        // NOTE: We assume that all members have root-level collection routes,
        // to avoid excessive nesting of (sub-)collection routes.
        return `${resource.path}/${resource.id}`
      },

      upload(resource) {
        // Dito Server handles upload routes on the collection resource:
        return `${this.collection(resource.parent)}/upload/${resource.path}`
      },

      ...api.resources
    }

    // Allow overriding / extending of headers:
    // api.headers = {
    //   'Content-Type': 'application/json'
    // }
    api.headers = {
      'Content-Type': 'application/json',
      ...api.headers
    }

    api.isApiRequest = api.isApiRequest || function(url) {
      return !isAbsoluteUrl(url) || url.startsWith(api.url)
    }

    if (isString(el)) {
      el = document.querySelector(el)
    }

    this.root = new Vue({
      el,
      router: new VueRouter({
        mode: 'history',
        base: dito.base,
        linkActiveClass: '',
        linkExactActiveClass: ''
      }),
      components: { DitoRoot },
      // Most injects are defined as functions, to preserve reactiveness across
      // provide/inject, see:
      // https://github.com/vuejs/vue/issues/7017#issuecomment-480906691
      provide: {
        api,
        // A default list of verbs are provided by $verbs() and can be
        // overridden at any point in the component hierarchy.
        $verbs: () => verbs,
        // Provide defaults so DitoMixin can inject them for all components:
        //   inject: [  '$isPopulated', '$schemaComponent', '$routeComponent' ]
        $views: () => {},
        $isPopulated: () => true,
        $schemaComponent: () => null,
        $schemaParentComponent: () => null,
        $routeComponent: () => null,
        $dataComponent: () => null,
        $sourceComponent: () => null,
        $resourceComponent: () => null,
        $dialogComponent: () => null,
        $panelComponent: () => null,
        $tabComponent: () => null
      },

      render: createElement => createElement(DitoRoot, {
        // Preserve the root container's id, as required by hot-reloading:
        attrs: {
          id: el.id
        },
        props: {
          unresolvedViews: views,
          options
        },
        // This may only be needed to avoid tree-shacking of these components,
        // since they actually handle registry internally already.
        components: {
          ...components,
          ...types
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
    const isApiRequest = this.api.isApiRequest(url)
    return axios.request({
      url,
      method,
      params,
      ...(data && { data }),
      baseURL: isApiRequest ? this.api.url : null,
      headers: {
        ...(isApiRequest && this.api.headers),
        ...headers
      },
      withCredentials: isApiRequest && !!this.api.cors?.credentials
    })
  }
}
