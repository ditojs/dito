import { createApp, h as createElement } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import VueNotifications from '@kyvg/vue3-notification'
import {
  isString,
  assignDeeply,
  hyphenate,
  defaultFormats
} from '@ditojs/utils'
import * as components from './components/index.js'
import * as types from './types/index.js'
import DitoRoot from './components/DitoRoot.vue'
import DitoView from './components/DitoView.vue'
import ResizeDirective from './directives/resize.js'
import { request, getApiUrl } from './utils/request.js'
import { ViewRegistry } from './utils/ViewRegistry.js'
import { AdminContext } from './utils/AdminContext.ts'
import { adminContextKey } from './utils/keys.ts'

// The options other than `dito`, `api` and `views`:
const knownOptions = ['login', 'spinner', 'account']

export default class DitoAdmin {
  constructor(el, {
    // The `dito` object of `createAdmin()`:
    dito: ditoObject = globalThis.dito ?? {},
    api,
    views = {},
    ...options
  } = {}) {
    // Merge the `api` settings of `config.admin` with the passed ones:
    this.api = api = assignDeeply({}, ditoObject.api, api)
    this.options = options
    for (const key of Object.keys(options)) {
      if (!knownOptions.includes(key)) {
        console.warn(`Unknown DitoAdmin option: '${key}'.`)
      }
    }
    api.locale ||= 'en-US'
    api.formats = assignDeeply({}, defaultFormats, api.formats)
    api.request = options => request(api, options)
    api.getApiUrl = options => getApiUrl(api, options)
    // Defaults for the schemas of component types, nested per type, as objects
    // or functions that return them or modify the schema directly:
    api.defaults ||= {}
    api.users = createUsersResource(api.users?.path)

    api.headers = {
      'Content-Type': 'application/json',
      ...api.headers
    }

    if (isString(el)) {
      el = document.querySelector(el)
    }
    this.el = el

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
      account: options.account,
      routeComponents: { view: DitoView }
    })

    const admin = (this.context = new AdminContext({
      api,
      router,
      viewRegistry,
      settings: ditoObject.settings ?? {},
      login: options.login
    }))

    const app = (this.app = createApp({
      provide: { [adminContextKey]: admin },

      render: () =>
        createElement(DitoRoot, {
          ref: 'root',
          class: admin.settings.rootClass,
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

// The resources of the routes of `defineUserActions()` on the server, under
// `path`, such as 'admins'.
function createUsersResource(path) {
  const users = { type: 'collection', path }
  const createChild = (childPath, method) => ({
    path: childPath,
    method,
    parent: users
  })
  users.login = createChild('login', 'post')
  users.logout = createChild('logout', 'post')
  // The logged-in user, which the account settings load and patch:
  users.self = createChild('self')
  // What the users API offers, which the admin loads before the login:
  users.capabilities = createChild('capabilities')
  for (const name of [
    'password',
    'passwordReset',
    'passwordResetConfirm',
    'passkeyLoginOptions',
    'passkeyLogin',
    'passkeyOptions',
    'loginCode',
    'totpConfirm',
    'confirmAccess'
  ]) {
    users[name] = createChild(hyphenate(name), 'post')
  }
  // The passkeys and the TOTP of the logged-in user, which the security dialog
  // manages:
  users.passkeys = { ...createChild('passkeys'), type: 'collection' }
  users.totp = createChild('totp')
  return users
}
