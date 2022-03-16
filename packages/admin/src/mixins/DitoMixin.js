import {
  isObject, isArray, isString, isFunction, asArray, equals,
  getValueAtDataPath, labelize, hyphenate, format
} from '@ditojs/utils'
import appState from '../appState.js'
import DitoComponent from '../DitoComponent.js'
import DitoContext from '../DitoContext.js'
import EmitterMixin from './EmitterMixin.js'
import { isMatchingType, convertType } from '../utils/type.js'
import { getResource, getMemberResource } from '../utils/resource.js'
import { deprecate } from '../utils/deprecate.js'

// @vue/component
export default {
  mixins: [EmitterMixin],

  inject: [
    'api',
    '$verbs',
    '$views',
    '$isPopulated',
    '$schemaComponent',
    '$routeComponent',
    '$dataComponent',
    '$sourceComponent',
    '$resourceComponent',
    '$dialogComponent',
    '$panelComponent',
    '$tabComponent'
  ],

  provide() {
    return this.providesData
      ? { $dataComponent: () => this }
      : {}
  },

  data() {
    return {
      appState,
      overrides: null // See accessor.js
    }
  },

  computed: {
    sourceSchema() {
      return this.meta?.schema
    },

    user() {
      return appState.user
    },

    // $verbs, $verbs and $isPopulated are defined as functions, to preserve
    // reactiveness across provide/inject.
    // See: https://github.com/vuejs/vue/issues/7017#issuecomment-480906691
    verbs() {
      return this.$verbs()
    },

    views() {
      return this.$views()
    },

    isPopulated() {
      return this.$isPopulated()
    },

    locale() {
      return this.api.locale
    },

    context() {
      return new DitoContext(this, { nested: false })
    },

    rootComponent() {
      return this.$root.$children[0]
    },

    schemaComponent() {
      // Use computed properties as links to injects, so DitoSchema can
      // override the property and return `this` instead of the parent.
      return this.$schemaComponent()
    },

    routeComponent() {
      // Use computed properties as links to injects, so RouteMixin can
      // override the property and return `this` instead of the parent.
      return this.$routeComponent()
    },

    formComponent() {
      const component = this.routeComponent
      return component?.isForm ? component : null
    },

    viewComponent() {
      const component = this.routeComponent
      return component?.isView ? component : null
    },

    // Returns the first route component in the chain of parents, including
    // this current component, that is linked to a resource (and thus loads its
    // own data and doesn't hold nested data).
    dataComponent() {
      return this.providesData ? this : this.$dataComponent()
    },

    sourceComponent() {
      return this.$sourceComponent()
    },

    resourceComponent() {
      return this.$resourceComponent()
    },

    dialogComponent() {
      return this.$dialogComponent()
    },

    panelComponent() {
      return this.$panelComponent()
    },

    tabComponent() {
      return this.$tabComponent()
    },

    parentSchemaComponent() {
      return this.schemaComponent?.$parent.schemaComponent
    },

    parentRouteComponent() {
      return this.routeComponent?.$parent.routeComponent
    },

    parentFormComponent() {
      return this.formComponent?.$parent.formComponent
    },

    // Returns the data of the first route component in the chain of parents
    // that loads its own data from an associated API resource.
    rootData() {
      return this.dataComponent?.data
    }
  },

  beforeCreate() {
    this.$uid = ++uid
  },

  methods: {
    // The state of components is only available during the life-cycle of a
    // component. Some information we need available longer than that, e.g.
    // `query` & `total` on TypeList, so that when the user navigates back from
    // editing an item in the list, the state of the list is still the same.
    // We can't store this in `data`, as this is already the pure data from the
    // API server. That's what the `store` is for: Memory that's available as
    // long as the current editing path is still valid. For type components,
    // this memory is provided by the parent, see RouteMixin and DitoPane.
    getStore(key) {
      return this.store[key]
    },

    setStore(key, value) {
      return this.$set(this.store, key, value)
    },

    getChildStore(key) {
      return this.getStore(key) || this.setStore(key, {})
    },

    getSchemaValue(
      keyOrDataPath,
      { type, default: def, schema = this.schema, callback = true } = {}
    ) {
      const types = type && asArray(type)
      // For performance reasons, data-paths in `keyOrDataPath` can only be
      // provided in in array format here:
      let value = schema
        ? isArray(keyOrDataPath)
          ? getValueAtDataPath(schema, keyOrDataPath, () => undefined)
          : schema[keyOrDataPath]
        : undefined

      if (value === undefined && def !== undefined) {
        if (callback && isFunction(def) && !isMatchingType(types, def)) {
          // Support `default()` functions for any type except `Function`:
          def = def.call(this, this.context)
        }
        return def
      }

      if (isMatchingType(types, value)) {
        return value
      }
      // Any schema value handled through `getSchemaValue()` can provide
      // a function that's resolved when the value is evaluated:
      if (callback && isFunction(value)) {
        value = value.call(this, this.context)
      }
      // Now finally see if we can convert to the expect types.
      if (types && value != null && !isMatchingType(types, value)) {
        for (const type of types) {
          const converted = convertType(type, value)
          if (converted !== value) {
            return converted
          }
        }
      }
      return value
    },

    getLabel(schema, name) {
      return schema
        ? this.getSchemaValue('label', { type: String, schema }) ||
          labelize(name || schema.name)
        : labelize(name) || ''
    },

    labelize,

    getButtonAttributes(name, button) {
      const verb = this.verbs[name] || name
      return {
        class: `dito-button-${verb}`,
        title: button?.text || labelize(verb)
      }
    },

    getDragOptions(draggable, fallback = false) {
      return {
        animation: 150,
        disabled: !draggable,
        handle: '.dito-button-drag',
        dragClass: 'dito-drag-active',
        chosenClass: 'dito-drag-chosen',
        ghostClass: 'dito-drag-ghost',
        fallbackClass: 'dito-drag-fallback',
        forceFallback: fallback
      }
    },

    getQueryLink(query) {
      return {
        query,
        // Preserve hash for tabs:
        hash: this.$route.hash
      }
    },

    shouldRender(schema = null) {
      return !!schema && this.getSchemaValue('if', {
        type: Boolean,
        default: true,
        schema
      })
    },

    showDialog({
      components,
      buttons,
      data,
      settings = {
        width: 480,
        height: 'auto',
        clickToClose: false
      }
    }) {
      // Shows a dito-dialog component through vue-js-modal, and wraps it in a
      // promise so that the buttons in the dialog can use `dialog.resolve()`
      // and `dialog.reject()` to close the modal dialog and resolve / reject
      // the promise at once.
      return new Promise((resolve, reject) => {
        this.$modal.show(DitoComponent.component('dito-dialog'), {
          components,
          buttons,
          data,
          promise: { resolve, reject }
        }, settings)
      })
    },

    getResourcePath(resource) {
      resource = getResource(resource)
      // Resources without a parent inherit the one from `dataComponent`
      // automatically.
      if (resource.parent === undefined) {
        resource.parent = this.dataComponent?.resource
      }
      return this.api.resources.any(getResource(resource))
    },

    getResourceUrl(resource) {
      const path = this.getResourcePath(resource)
      let url = null
      if (path) {
        // Use same approach as axios internally to join baseURL with path:
        url = `${
          this.api.url.replace(/\/+$/, '')
        }/${
          path.replace(/^\/+/, '')
        }`
        // Support optional query parameters, which are added to the URL:
        const { query } = resource
        if (query) {
          const params = Object.entries(query).map(
            ([key, value]) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
          )
          url = `${url}?${params.join('&')}`
        }
      }
      return url
    },

    async sendRequest({ method, url, resource, data, params, internal }) {
      url = url || this.getResourcePath(resource)
      method = method || resource?.method
      const checkUser = !internal && this.api.isApiRequest(url)
      if (checkUser) {
        await this.rootComponent.ensureUser()
      }
      const response = await this.api.request({ method, url, data, params })
      // Detect change of the own user, and fetch it again if it was changed.
      if (
        checkUser &&
        method === 'patch' &&
        equals(resource, getMemberResource(this.user.id, this.api.users))
      ) {
        await this.rootComponent.fetchUser()
      }
      return response
    },

    request({ cache, ...options }) {
      // Allow caching of loaded data on two levels:
      // - 'global': cache globally, for the entire admin session
      // - 'local': cache locally within the closest route component that is
      //    associated with a resource and loads its own data.
      const cacheParent = cache && {
        global: this.appState,
        local: this.dataComponent
      }[cache]
      const loadCache = cacheParent?.loadCache
      // Build a cache key from the config:
      const cacheKey = loadCache && `${
        options.method || 'get'} ${
        options.url} ${
        JSON.stringify(options.params || '')} ${
        JSON.stringify(options.data || '')
      }`
      if (loadCache && (cacheKey in loadCache)) {
        return loadCache[cacheKey]
      }
      // NOTE: No await here, res is a promise that we can easily cache.
      // That's fine because promises can be resolved over and over again.
      const res = this.sendRequest(options)
        .then(response => response.data)
        .catch(error => {
          // Convert axios errors to normal errors
          const data = error.response?.data
          throw data
            ? Object.assign(new Error(data.message), data)
            : error
        })
      if (loadCache) {
        loadCache[cacheKey] = res
      }
      return res
    },

    load(options) {
      deprecate('load() is deprecated. Use request() instead.')
      return this.request(options)
    },

    format(value, {
      locale = this.api.locale,
      defaults = this.api.formats,
      ...options
    } = {}) {
      return format(value, {
        locale,
        defaults,
        ...options
      })
    },

    async navigate(location) {
      return new Promise(resolve => {
        this.$router.push(
          location,
          () => resolve(true),
          () => resolve(false)
        )
      })
    },

    download(options = {}) {
      if (isString(options)) {
        options = { url: options }
      }
      const { url, filename } = options
      // See: https://stackoverflow.com/a/49917066/1163708
      const a = document.createElement('a')
      a.href = url
      if (filename) {
        a.download = filename
      }
      const { body } = document
      body.appendChild(a)
      a.click()
      body.removeChild(a)
    },

    notify(options) {
      this.rootComponent.notify(options)
    },

    closeNotifications() {
      this.rootComponent.closeNotifications()
    },

    setupSchemaFields() {
      this.setupMethods()
      this.setupComputed()
      this.setupEvents()
    },

    setupMethods() {
      for (const [key, value] of Object.entries(this.schema.methods || {})) {
        if (isFunction(value)) {
          this[key] = value
        } else {
          console.error(`Invalid method definition: ${key}: ${value}`)
        }
      }
    },

    setupComputed() {
      for (const [key, value] of Object.entries(this.schema.computed || {})) {
        const accessor = isFunction(value)
          ? { get: value }
          : isObject(value) && isFunction(value.get)
            ? value
            : null
        if (accessor) {
          Object.defineProperty(this, key, accessor)
        } else {
          console.error(
            `Invalid computed property definition: ${key}: ${value}`
          )
        }
      }
    },

    setupEvents() {
      const { watch, events } = this.schema
      if (watch) {
        const handlers = isFunction(watch) ? watch.call(this) : watch
        if (isObject(handlers)) {
          // Install the watch handlers in the next tick, so all components are
          // initialized and we can check against their names.
          this.$nextTick(() => {
            for (const [key, callback] of Object.entries(handlers)) {
              // Expand property names to 'data.property':
              const expr = this.schemaComponent.getComponentByName(key)
                ? `data.${key}`
                : key
              this.$watch(expr, callback)
            }
          })
        }
      }

      const addEvent = (key, event, callback) => {
        if (isFunction(callback)) {
          this.on(hyphenate(event), callback)
        } else {
          console.error(`Invalid event definition: ${key}: ${callback}`)
        }
      }

      if (events) {
        for (const [key, value] of Object.entries(events)) {
          addEvent(key, key, value)
        }
      }
      // Also scan schema for `on[A-Z]`-style callbacks and add them
      // TODO: Deperecate one format or the other, in favour of only one way of
      // doing things. Decide which one to remove.
      for (const [key, value] of Object.entries(this.schema)) {
        if (/^on[A-Z]/.test(key)) {
          addEvent(key, key.slice(2), value)
        }
      }
    },

    async emitEvent(event, {
      context = null,
      parent = null
    } = {}) {
      const hasListeners = this.hasListeners(event)
      const parentHasListeners = parent?.hasListeners(event)
      if (hasListeners || parentHasListeners) {
        // The effects of some events need some time to propagate through Vue.
        // Use $nextTick() to make sure our handlers see these changes.
        // For example, `processedItem` is only correct after components that
        // are newly rendered due to data changes have registered themselves.
        if (['load', 'change'].includes(event)) {
          await this.$nextTick()
        }

        const getContext = () => (context = DitoContext.get(this, context))
        const res = hasListeners
          ? await this.emit(event, getContext())
          : undefined
        // Don't bubble to parent if handled event returned `false`
        if (parentHasListeners && res !== false) {
          parent.emit(event, getContext())
        }
        return res
      }
    },

    emitSchemaEvent(event, params) {
      return this.schemaComponent.emitEvent(event, params)
    }
  }
}

let uid = 0
