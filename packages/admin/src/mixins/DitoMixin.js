import {
  isObject,
  isString,
  isFunction,
  equals,
  labelize,
  hyphenate,
  format
} from '@ditojs/utils'
import appState from '../appState.js'
import DitoContext from '../DitoContext.js'
import EmitterMixin from './EmitterMixin.js'
import {
  flattenViews,
  getSchemaValue,
  shouldRenderSchema
} from '../utils/schema.js'
import { getResource, getMemberResource } from '../utils/resource.js'
import { computed, reactive } from 'vue'

// @vue/component
export default {
  mixins: [EmitterMixin],

  inject: [
    'api',
    '$verbs',
    '$views',
    '$isPopulated',
    '$parentComponent',
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
    const self = () => this
    return this.providesData
      ? {
          $parentComponent: self,
          $dataComponent: self
        }
      : {
          $parentComponent: self
        }
  },

  data() {
    return {
      appState,
      isMounted: false,
      overrides: null // See accessor.js
    }
  },

  computed: {
    providesData() {
      // NOTE: This is overridden in ResourceMixin, used by lists.
      return false
    },

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

    flattenedViews() {
      return flattenViews(this.views)
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
      return this.$root.$refs.root
    },

    // Use computed properties as links to injects, so DitoSchema can
    // override the property and return `this` instead of the parent.
    parentComponent() {
      return this.$parentComponent()
    },

    schemaComponent() {
      return this.$schemaComponent()
    },

    routeComponent() {
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
      return this.schemaComponent?.parentComponent.schemaComponent
    },

    parentRouteComponent() {
      return this.routeComponent?.parentComponent.routeComponent
    },

    parentFormComponent() {
      return this.formComponent?.parentComponent.formComponent
    },

    // Returns the data of the first route component in the chain of parents
    // that loads its own data from an associated API resource.
    rootData() {
      return this.dataComponent?.data
    }
  },

  mounted() {
    this.isMounted = true
  },

  beforeCreate() {
    const uid = nextUid++
    Object.defineProperty(this, '$uid', { get: () => uid })
  },

  methods: {
    labelize,

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
      this.store[key] = value
      return value
    },

    removeStore(key) {
      delete this.store[key]
    },

    getStoreKeyByIndex(index) {
      return this.store.$keysByIndex?.[index]
    },

    setStoreKeyByIndex(index, key) {
      this.store.$keysByIndex ??= {}
      this.store.$keysByIndex[index] = key
    },

    getChildStore(key, index) {
      let store = this.getStore(key)
      if (!store && index != null) {
        // When storing, temporary ids change to permanent ones and thus the key
        // can change. To still find the store, we reference by index as well,
        // to be able to find the store again after the item was saved.
        const oldKey = this.getStoreKeyByIndex(index)
        store = this.getStore(oldKey)
        if (store) {
          this.setStore(key, store)
          this.removeStore(oldKey)
        }
      }
      if (!store) {
        store = this.setStore(key, reactive({}))
        if (index != null) {
          this.setStoreKeyByIndex(index, key)
        }
      }
      return store
    },

    removeChildStore(key, index) {
      // GEt the child-store first, so that indices can be transferred over
      // temporary id changes during persistence.
      this.getChildStore(key, index)
      this.removeStore(key)
    },

    getSchemaValue(
      keyOrDataPath,
      {
        type,
        default: def,
        schema = this.schema,
        context = this.context,
        callback = true
      } = {}
    ) {
      return getSchemaValue(keyOrDataPath, {
        type,
        schema,
        context,
        callback,
        default: isFunction(def) ? () => def.call(this) : def
      })
    },

    getLabel(schema, name) {
      return schema
        ? this.getSchemaValue('label', { type: String, schema }) ||
          labelize(name || schema.name)
        : labelize(name) || ''
    },

    getButtonAttributes(verb) {
      return {
        class: `dito-button-${verb}`,
        title: labelize(verb)
      }
    },

    // TODO: Rename *Link() to *Route().
    getQueryLink(query) {
      return {
        query,
        // Preserve hash for tabs:
        hash: this.$route.hash
      }
    },

    shouldRenderSchema(schema = null) {
      return shouldRenderSchema(schema, this.context)
    },

    shouldShowSchema(schema = null) {
      return this.getSchemaValue('visible', {
        type: Boolean,
        default: true,
        schema
      })
    },

    shouldDisableSchema(schema = null) {
      return this.getSchemaValue('disabled', {
        type: Boolean,
        default: false,
        schema
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
      const url = this.getResourcePath(resource)
      return url ? this.api.getApiUrl({ url, query: resource.query }) : null
    },

    async sendRequest({
      method,
      url,
      resource,
      query,
      data,
      signal,
      internal
    }) {
      url ||= this.getResourceUrl(resource)
      method ||= resource?.method
      const checkUser = !internal && this.api.isApiUrl(url)
      if (checkUser) {
        await this.rootComponent.ensureUser()
      }
      const response = await this.api.request({
        method,
        url,
        query,
        data,
        signal
      })
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

    showDialog({ components, buttons, data, settings }) {
      return this.rootComponent.showDialog({
        components,
        buttons,
        data,
        settings
      })
    },

    request({ cache, ...options }) {
      // Allow caching of loaded data on two levels:
      // - 'global': cache globally, for the entire admin session
      // - 'local': cache locally within the closest route component that is
      //    associated with a resource and loads its own data.
      const cacheParent = (
        cache &&
        {
          global: this.appState,
          local: this.dataComponent
        }[cache]
      )
      const loadCache = cacheParent?.loadCache
      // Build a cache key from the config:
      const cacheKey = (
        loadCache &&
        `${
          options.method || 'get'
        } ${
          options.url
        } ${
          // TODO: `request.params` was deprecated in favour of `query` on
          // 2022-11-01, remove once not in use anywhere any more.
          JSON.stringify(options.query || options.params || '')
        } ${
          JSON.stringify(options.data || '')
        }`
      )
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
      return this.$router.push(location)
    },

    download(options = {}) {
      if (isString(options)) {
        options = { url: options }
      }
      // See: https://stackoverflow.com/a/49917066/1163708
      const a = document.createElement('a')
      a.href = options.url?.startsWith('blob:')
        ? options.url
        : this.api.getApiUrl(options)
      a.download = options.filename ?? null
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
      const getComputedAccessor = ({ get, set }) => {
        const getter = computed(() => get.call(this))
        return {
          get: () => getter.value,
          set: set ? value => set.call(this, value) : undefined
        }
      }

      for (const [key, item] of Object.entries(this.schema.computed || {})) {
        const accessor = isFunction(item)
          ? getComputedAccessor({ get: item })
          : isObject(item) && isFunction(item.get)
            ? getComputedAccessor(item)
            : null
        if (accessor) {
          Object.defineProperty(this, key, accessor)
        } else {
          console.error(
            `Invalid computed property definition: ${key}: ${item}`
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
      // TODO: Deprecate one format or the other, in favour of only one way of
      // doing things. Decide which one to remove.
      for (const [key, value] of Object.entries(this.schema)) {
        if (/^on[A-Z]/.test(key)) {
          addEvent(key, key.slice(2), value)
        }
      }
    },

    emitEvent(event, {
      context = null,
      parent = null
    } = {}) {
      const hasListeners = this.hasListeners(event)
      const parentHasListeners = parent?.hasListeners(event)
      if (hasListeners || parentHasListeners) {
        const emitEvent = target =>
          target.emit(event, (context = DitoContext.get(this, context)))

        const handleParentListeners = result =>
          // Don't bubble to parent if handled event returned `false`
          parentHasListeners && result !== false
            ? emitEvent(parent).then(() => result)
            : result

        const handleListeners = () =>
          hasListeners
            ? emitEvent(this).then(handleParentListeners)
            : handleParentListeners(undefined)

        return ['load', 'change'].includes(event)
          ? // The effects of some events need time to propagate through Vue.
            // Use $nextTick() to make sure our handlers see these changes.
            // For example, `processedItem` is only correct after components
            // that are newly rendered due to data changes have registered.
            // NOTE: The result of `handleListeners()` makes it through the
            // `$nextTick()` call and will be returned as expected.
            this.$nextTick(handleListeners)
          : handleListeners()
      }
    },

    emitSchemaEvent(event, params) {
      return this.schemaComponent.emitEvent(event, params)
    }
  }
}

let nextUid = 0
