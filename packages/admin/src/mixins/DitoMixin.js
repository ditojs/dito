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
import { flattenViews } from '../utils/schema/setup.js'
import { getSchemaValue, shouldRenderSchema } from '../utils/schema/data.js'
import { getResource, getMemberResource } from '../utils/resource.js'
import { appendDataPath, getRelativeDataPath } from '../utils/data.js'
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
    '$dataModel',
    '$panelComponent',
    '$tabComponent'
  ],

  provide() {
    const self = () => this
    return {
      $parentComponent: self,
      ...(this.providesData && { $dataComponent: self }),
      $dataModel: () => this.dataModel
    }
  },

  data() {
    return {
      appState,
      isMounted: false,
      overrides: null, // See accessor.js
      // The data model that the component owns, see `dataModel`.
      ownDataModel: null
    }
  },

  computed: {
    // The data model of the data: the component's own, e.g. of a form, view
    // or dialog, or else the one of its closest ancestor that owns one.
    dataModel() {
      return this.ownDataModel ?? this.$dataModel()
    },

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

    // The path of component names through views, tabs, panels and forms, with
    // item indices from the data path, e.g. `main/chapters/0/title`. Unlike
    // `dataPath`, it tells apart components that display the same data, and
    // is used for registries and DOM ids. Components continue the path of
    // their parent with the item indices that their data path adds to the
    // parent's, e.g. inlined list items. `DitoContainer`, `DitoPane` and
    // `DitoPanel` add the names of components, tabs and panels, `DitoButtons`
    // the names of button groups, `DitoForm` and `DitoTreeItem` continue the
    // path of the source of their item.
    componentPath() {
      return this.continueParentComponentPath()
    },

    // The data path that `componentPath` corresponds to, which children
    // compare their data path with: the component's own, or for components
    // without data path, e.g. `DitoDraggable` between lists and their items,
    // the one of their parent.
    dataPathForComponentPath() {
      return this.dataPath ?? this.parentComponent?.dataPathForComponentPath
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
      return getParentComponent(this, 'schemaComponent')
    },

    parentRouteComponent() {
      return getParentComponent(this, 'routeComponent')
    },

    parentFormComponent() {
      return getParentComponent(this, 'formComponent')
    },

    parentResourceComponent() {
      return getParentComponent(this, 'resourceComponent')
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
      }
      if (index != null) {
        // temporary uid keys will change between persistence, so we need to
        // assign the key to the index even when the store already existed.
        this.setStoreKeyByIndex(index, key)
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
        ? this.getSchemaValue('label', { schema, type: [String, Object] }) ||
          labelize(name || schema.name)
        : labelize(name) || ''
    },

    getButtonAttributes(verb, subject = null, text = null) {
      // Buttons that display text are named by it, others by what they act on
      // if known, e.g. 'Add Section'.
      const label = text
        ? null
        : `${labelize(verb)}${subject ? ` ${subject}` : ''}`
      return {
        class: `dito-button--${verb}`,
        ...(label && {
          'title': label,
          'aria-label': label
        })
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
      resource = getResource(resource, {
        // Resources without a parent inherit the one from `dataComponent`
        // automatically.
        parent: this.dataComponent?.getResource({
          method: resource?.method,
          child: resource
        }) ?? null
      })
      return this.api.resources.any(resource)
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
      // Requests to resources are told apart by the URLs that they resolve to:
      const { resource } = options
      const cacheKey = (
        loadCache &&
        getRequestCacheKey({
          ...options,
          method: options.method || resource?.method,
          url: options.url || (resource ? this.getResourceUrl(resource) : null)
        })
      )
      if (loadCache && (cacheKey in loadCache)) {
        return loadCache[cacheKey]
      }
      // NOTE: No await here, res is a promise that we can easily cache.
      // That's fine because promises can be resolved over and over again.
      const res = this.sendRequest(options)
        .then(response => response.data)
        .catch(error => {
          // Failed requests aren't cached, so they can be retried:
          if (loadCache?.[cacheKey] === res) {
            delete loadCache[cacheKey]
          }
          // Convert errors of responses with data, e.g. Dito.js errors, to
          // errors with the message and properties of that data:
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

    // Returns the component path of the parent, continued with the item
    // indices that the data path of this component adds to the parent's, see
    // `componentPath`.
    continueParentComponentPath() {
      const { parentComponent } = this
      const parentComponentPath = parentComponent?.componentPath ?? ''
      const relativeDataPath = getRelativeDataPath(
        this.dataPath,
        parentComponent?.dataPathForComponentPath
      )
      return relativeDataPath
        ? appendDataPath(parentComponentPath, relativeDataPath)
        : parentComponentPath
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
          warnAboutOverriddenMember(this, key, 'method')
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
          warnAboutOverriddenMember(this, key, 'computed property')
          Object.defineProperty(this, key, accessor)
        } else {
          console.error(
            `Invalid computed property definition: ${key}: ${item}`
          )
        }
      }
    },

    setupEvents() {
      const { watch } = this.schema
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

      const eventEntries = getSchemaEventEntries(this.schema)
      for (const { key, event, callback } of eventEntries) {
        if (isFunction(callback)) {
          this.on(event, callback)
        } else {
          console.error(`Invalid event definition: ${key}: ${callback}`)
        }
      }
    },

    emitEvent(event, {
      context = null,
      parent = null,
      ...unsupportedOptions
    } = {}) {
      const unsupportedKeys = Object.keys(unsupportedOptions)
      if (unsupportedKeys.length > 0) {
        // Values for the handlers are passed through `context`, e.g.
        // `emitEvent('error', { context: { error } })`.
        console.warn(
          `Unsupported options for event '${event}': ` +
          `${unsupportedKeys.join(', ')}. Pass them through \`context\`.`
        )
      }
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
          ? // The effects of these events need time to propagate, so that the
            // handlers see them: Components that are newly rendered due to
            // data changes register, e.g. for `processedItem`, and the form
            // model writes the values that it derives from the data.
            // NOTE: The result of `handleListeners()` is returned as expected.
            this.waitUntilDataModelSettled().then(handleListeners)
          : handleListeners()
      }
    },

    // Waits until the data model settled: its loads finished, and it wrote the
    // values that it derives from the data, e.g. before submitting. Shows the
    // spinner in the header while loads are pending, like requests do.
    async waitUntilDataModelSettled() {
      await this.$nextTick()
      const { dataModel } = this
      if (dataModel?.hasPendingLoads) {
        this.rootComponent.registerLoading(true)
        try {
          await dataModel.waitUntilSettled()
        } finally {
          this.rootComponent.registerLoading(false)
        }
      }
    },

    emitSchemaEvent(event, params) {
      return this.schemaComponent.emitEvent(event, params)
    }
  }
}

let nextUid = 0

// Returns the event handlers that `schema` defines, both in `events` and as
// `on[A-Z]` callbacks, e.g. `events: { mouseenter }` and `onMouseenter`, with
// the hyphenated event names that they are registered and emitted under.
// TODO: Deprecate one format or the other, in favour of only one way of
// doing things. Decide which one to remove.
export function getSchemaEventEntries(schema) {
  const entries = []
  for (const [key, callback] of Object.entries(schema.events || {})) {
    entries.push({ key, event: hyphenate(key), callback })
  }
  for (const [key, callback] of Object.entries(schema)) {
    if (/^on[A-Z]/.test(key)) {
      entries.push({ key, event: hyphenate(key.slice(2)), callback })
    }
  }
  return entries
}

// The keys of the members that the schemas define on components, through
// `methods` and `computed`, to tell them apart from the component's own ones
// when the schema is set up again.
const schemaMemberKeysByComponent = new WeakMap()

// Warns when the schema defines a method or computed property that overrides
// a member of the component, e.g. a method or property of Dito.js itself.
function warnAboutOverriddenMember(component, key, kind) {
  let schemaMemberKeys = schemaMemberKeysByComponent.get(component)
  if (!schemaMemberKeys) {
    schemaMemberKeys = new Set()
    schemaMemberKeysByComponent.set(component, schemaMemberKeys)
  }
  if (key in component && !schemaMemberKeys.has(key)) {
    console.warn(
      `The schema ${kind} '${key}' overrides a member of the component.`
    )
  }
  schemaMemberKeys.add(key)
}

// Returns the key under which `request()` caches the response of a request.
function getRequestCacheKey({ method, url, query, data }) {
  return [
    method || 'get',
    url,
    JSON.stringify(query || ''),
    JSON.stringify(data || '')
  ].join(' ')
}

function getParentComponent(component, key) {
  const current = component[key]
  let parent = component.parentComponent
  while (parent && parent[key] === current) {
    parent = parent.parentComponent
  }
  return parent?.[key] ?? null
}
