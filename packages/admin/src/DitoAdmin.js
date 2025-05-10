import { createApp, h as createElement } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import VueNotifications from '@kyvg/vue3-notification'
import {
  isString,
  isAbsoluteUrl,
  assignDeeply,
  hyphenate,
  camelize,
  defaultFormats
} from '@ditojs/utils'
import * as components from './components/index.js'
import * as types from './types/index.js'
import DitoRoot from './components/DitoRoot.vue'
import DitoTypeComponent from './DitoTypeComponent.js'
import ResizeDirective from './directives/resize.js'
import { getResource } from './utils/resource.js'
import { formatQuery } from './utils/route.js'
import verbs from './verbs.js'

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
    this.api = api = assignDeeply({ base: '/' }, dito.api, api)
    this.options = options

    // Setup default api settings:
    api.locale ||= 'en-US'
    api.formats = assignDeeply({}, defaultFormats, api.formats)
    api.request ||= options => request(api, options)
    api.getApiUrl ||= options => getApiUrl(api, options)
    api.isApiUrl ||= url => isApiUrl(api, url)
    // Setting `api.normalizePaths = true (plural) sets both:
    // `api.normalizePath = hyphenate` and `api.denormalizePath = camelize`
    api.normalizePath ||= api.normalizePaths ? hyphenate : val => val
    api.denormalizePath ||= api.normalizePaths ? camelize : val => val

    // Allow definition of defaults for admin component types, nested per type:
    // api.defaults = {
    //   'multiselect': {
    //     selectable: true
    //   },
    //   'fake-type': schema => {
    //     // Return defaults, or directly modify the schema:
    //     Object.assign(schema, {
    //       type: 'real-type',
    //       format: ({ value }) => `Formatted ${value}`,
    //       process: ({ value }) => `Processed ${value}`
    //     })
    //   }
    // }

    api.defaults ||= {}

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
    const users = getResource(api.users, {
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
    api.users = users

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
        return `${this.default(resource)}/${resource.id}`
      },

      upload(resource) {
        // Dito.js Server handles upload routes on the collection resource:
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

    if (isString(el)) {
      el = document.querySelector(el)
    }

    const app = (this.app = createApp({
      components: {
        DitoRoot,
        VueNotifications,
        // This may only be needed to avoid tree-shacking of these components,
        // since they actually handle registry internally already.
        // TODO: Remove this once we have a better solution.
        ...components,
        ...types
      },

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
        $parentComponent: () => null,
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

      render: () =>
        createElement(DitoRoot, {
          ref: 'root',
          class: dito.settings.rootClass,
          unresolvedViews: views,
          options
        })
    }))

    // Prevent endless loops of error messages during render functions by
    // setting a custom error handler.
    app.config.errorHandler = console.error

    app.use(VueNotifications, {
      componentName: 'VueNotifications',
      name: 'notify'
    })

    app.directive('resize', ResizeDirective)

    app.use(
      createRouter({
        // Start with a catch-all route, to be replaced by the actual routes
        // once the schemas are loaded, to prevent vue-router from complaining,
        // see: `resolveViews()` in `DitoRoot` for the actual route setup.
        routes: [
          {
            name: 'catch-all',
            path: '/:_(.*)',
            components: {}
          }
        ],
        history: createWebHistory(dito.base),
        linkActiveClass: '',
        linkExactActiveClass: ''
      })
    )

    el.classList.add('dito-app')
    app.mount(el)
  }

  register(type, options) {
    return DitoTypeComponent.register(type, options)
  }
}

class RequestError extends Error {
  constructor(response) {
    super(
      `Request failed with status code: ${response.status} (${
        response.statusText
      })`
    )
    this.response = response
  }
}

async function request(api, {
  url,
  method = 'get',
  query = null,
  headers = null,
  data = null,
  signal = null
}) {
  const isApiUrl = api.isApiUrl(url)

  const response = await fetch(api.getApiUrl({ url, query }), {
    method: method.toUpperCase(),
    ...(data && { body: JSON.stringify(data) }),
    headers: {
      ...(isApiUrl && api.headers),
      ...headers
    },
    credentials:
      isApiUrl && api.cors?.credentials
        ? 'include'
        : 'same-origin',
    signal
  })

  if (response.headers.get('Content-Type')?.includes('application/json')) {
    response.data = await response.json()
  }

  if (!response.ok) {
    throw new RequestError(response)
  }
  return response
}

function isApiUrl(api, url) {
  return !isAbsoluteUrl(url) || url.startsWith(api.url)
}

function getApiUrl(api, { url, query }) {
  if (!url.startsWith(api.url) && !isAbsoluteUrl(url)) {
    url = combineUrls(api.url, url)
  }
  // Support optional query parameters, to be are added to the URL.
  const search = formatQuery(query)
  return search ? `${url}${url.includes('?') ? '&' : '?'}${search}` : url
}

function combineUrls(baseUrl, relativeUrl) {
  // Use same approach as axios `combineURLs()` to join baseUrl & relativeUrl:
  return `${baseUrl.replace(/\/+$/, '')}/${relativeUrl.replace(/^\/+/, '')}`
}
