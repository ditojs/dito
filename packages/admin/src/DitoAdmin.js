import { createApp, h as createElement } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import VueNotifications from '@kyvg/vue3-notification'
import {
  isString,
  assignDeeply,
  hyphenate,
  camelize,
  defaultFormats
} from '@ditojs/utils'
import * as components from './components/index.js'
import * as types from './types/index.js'
import DitoRoot from './components/DitoRoot.vue'
import DitoView from './components/DitoView.vue'
import DitoForm from './components/DitoForm.vue'
import DitoFormNested from './components/DitoFormNested.vue'
import ResizeDirective from './directives/resize.js'
import { getResource } from './utils/resource.js'
import { request, getApiUrl, isApiUrl } from './utils/request.js'
import { Session } from './utils/Session.js'
import { ViewRegistry } from './utils/ViewRegistry.js'
import { AdminContext } from './utils/AdminContext.ts'

export default class DitoAdmin {
  constructor(el, {
    // The base, api and settings passed from `AdminController`:
    dito: ditoObject = globalThis.dito ?? {},
    api,
    views = {},
    ...options
  } = {}) {
    this.el = el
    // Merge the `api` settings of `config.admin` with the passed ones:
    this.api = api = assignDeeply({ base: '/' }, ditoObject.api, api)
    this.options = options

    api.locale ||= 'en-US'
    api.formats = assignDeeply({}, defaultFormats, api.formats)
    api.request ||= options => request(api, options)
    api.getApiUrl ||= options => getApiUrl(api, options)
    api.isApiUrl ||= url => isApiUrl(api, url)
    api.normalizePath ||= api.normalizePaths ? hyphenate : val => val
    api.denormalizePath ||= api.normalizePaths ? camelize : val => val
    api.defaults ||= {}

    const users = getResource(api.users, { type: 'collection' }) || {}
    const methods = { login: 'post', logout: 'post', session: 'get' }
    for (const [name, method] of Object.entries(methods)) {
      users[name] = getResource(users[name] || name, { method, parent: users })
    }
    api.users = users

    // Apps may override the handlers of resource paths:
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
        return `${this.default(resource)}/${resource.id}`
      },

      upload(resource) {
        // Dito.js Server handles upload routes on the collection resource:
        return `${this.collection(resource.parent)}/upload/${resource.path}`
      },

      ...api.resources
    }

    api.headers = {
      'Content-Type': 'application/json',
      ...api.headers
    }

    if (isString(el)) {
      el = document.querySelector(el)
    }

    const router = createRouter({
      // Keep vue-router from complaining until `ViewRegistry` sets up routes:
      routes: [
        {
          name: 'catch-all',
          path: '/:_(.*)',
          components: {}
        }
      ],
      history: createWebHistory(ditoObject.base),
      linkActiveClass: '',
      linkExactActiveClass: ''
    })

    const viewRegistry = new ViewRegistry({
      api,
      router,
      unresolvedViews: views,
      routeComponents: {
        view: DitoView,
        form: DitoForm,
        nestedForm: DitoFormNested
      }
    })

    const session = new Session({
      api,
      viewRegistry,
      redirectAfterLogin: options.login?.redirectAfterLogin
    })

    const admin = (this.context = new AdminContext({
      api,
      router,
      session,
      viewRegistry
    }))

    const app = (this.app = createApp({
      provide: { adminContext: admin },

      render: () =>
        createElement(DitoRoot, {
          ref: 'root',
          class: ditoObject.settings?.rootClass,
          options
        })
    }))

    // Prevent endless loops of error messages during render functions:
    app.config.errorHandler = console.error

    app.use(VueNotifications, {
      componentName: 'VueNotifications',
      name: 'notify'
    })

    app.directive('resize', ResizeDirective)

    // Components use each other through their global names, as do the custom
    // components of apps, which also keeps them from being tree-shaken:
    for (const [name, component] of Object.entries({
      ...components,
      ...types
    })) {
      app.component(name, component)
    }

    app.use(router)

    el.classList.add('dito-app')
    app.mount(el)
  }
}
