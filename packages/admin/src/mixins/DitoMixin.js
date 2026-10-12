import {
  isString,
  isFunction,
  equals,
  labelize,
  format
} from '@ditojs/utils'
import appState from '../appState.js'
import DitoContext from '../DitoContext.js'
import EmitterMixin from './EmitterMixin.js'
import { getSchemaEventEntries } from '../utils/schema/events.js'
import { getSchemaValue, shouldRenderSchema } from '../utils/schema/data.js'
import { getResource, getMemberResource } from '../utils/resource.js'
import { getRequestCacheKey } from '../utils/request.js'
import { appendDataPath, getRelativeDataPath } from '../utils/data.js'
import { reactive } from 'vue'

// @vue/component
export default {
  mixins: [EmitterMixin],

  inject: {
    admin: 'admin',
    $verbs: '$verbs',
    $isPopulated: '$isPopulated',
    $parentComponent: '$parentComponent',
    $schemaComponent: '$schemaComponent',
    $dataComponent: '$dataComponent',
    $sourceComponent: '$sourceComponent',
    $resourceComponent: '$resourceComponent',
    $tabComponent: '$tabComponent',
    $loadingTracker: '$loadingTracker',
    // The contexts that the closest owners of a data model and of a route
    // provide, see `container` and `route`:
    parentContainer: 'container',
    parentRoute: 'route'
  },

  provide() {
    const self = () => this
    return {
      $parentComponent: self,
      ...(this.providesData && { $dataComponent: self })
    }
  },

  data() {
    return {
      appState,
      isMounted: false,
      overrides: null, // See accessor.js
      // The data model that the component owns, see `dataModel`, and the
      // contexts that it provides, see `container` and `route`:
      ownDataModel: null,
      ownContainer: null,
      ownRoute: null
    }
  },

  computed: {
    // The context of the owner of the data model of the data: the component
    // itself, e.g. a form, view, dialog or panel with its own data, or else its
    // closest ancestor that owns one.
    container() {
      return this.ownContainer ?? this.parentContainer
    },

    // The context of the view or form that renders the component, or that the
    // component is:
    route() {
      return this.ownRoute ?? this.parentRoute
    },

    dataModel() {
      return this.ownDataModel ?? this.parentContainer?.model ?? null
    },

    providesData() {
      // NOTE: This is overridden in ResourceMixin, used by lists.
      return false
    },

    sourceSchema() {
      return this.meta?.schema
    },

    // $verbs and $isPopulated are defined as functions, to preserve
    // reactiveness across provide/inject.
    // See: https://github.com/vuejs/vue/issues/7017#issuecomment-480906691
    verbs() {
      return this.$verbs()
    },

    isPopulated() {
      return this.$isPopulated()
    },

    context() {
      return new DitoContext(this, { nested: false })
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

    tabComponent() {
      return this.$tabComponent()
    },

    parentSchemaComponent() {
      return getParentComponent(this, 'schemaComponent')
    },

    parentResourceComponent() {
      return getParentComponent(this, 'resourceComponent')
    },

    // Returns the data of the source with its own resource that the component
    // is in, or else the root data of the route, e.g. the data of the view when
    // it has no resource, or the draft root of a nested form, see
    // `DitoView.rootData()` and `DitoForm.rootData()`.
    rootData() {
      const { dataComponent } = this
      return dataComponent && !dataComponent.ownRoute
        ? dataComponent.data
        : this.route?.container.rootData
    }
  },

  mounted() {
    this.isMounted = true
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

    // Returns the store of the child component named `name`, e.g. of the
    // components of a pane. The stores of list items are kept separately, see
    // `ItemStores`.
    getChildStore(name) {
      return this.getStore(name) ?? this.setStore(name, reactive({}))
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
      const { dataComponent } = this
      resource = getResource(resource, {
        // Resources without a parent inherit the one from `dataComponent`
        // automatically, unless it's a view, which provides the data of its
        // components with resources, but has no resource of its own.
        parent:
          dataComponent && !dataComponent.isView
            ? (dataComponent.getResource({
                method: resource?.method,
                child: resource
              }) ?? null)
            : null
      })
      return this.admin.api.resources.any(resource)
    },

    getResourceUrl(resource) {
      const url = this.getResourcePath(resource)
      return url
        ? this.admin.api.getApiUrl({ url, query: resource.query })
        : null
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
      const { api, session } = this.admin
      url ||= this.getResourceUrl(resource)
      method ||= resource?.method
      const checkUser = !internal && api.isApiUrl(url)
      if (checkUser) {
        await session.ensureUser()
      }
      const response = await api.request({
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
        equals(resource, getMemberResource(session.user.id, api.users))
      ) {
        await session.fetchUser()
      }
      return response
    },

    request({ cache, ...options }) {
      // Allow caching of loaded data on two levels:
      // - 'global': cache globally, for the entire admin session
      // - 'local': cache locally within the closest route component, i.e. the
      //   form or view, for as long as it is shown. Components outside of
      //   route components, e.g. in dialogs, don't cache locally.
      const loadCache =
        cache === 'global'
          ? this.appState.loadCache
          : cache === 'local'
            ? this.route?.loadCache
            : null
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
      locale = this.admin.api.locale,
      defaults = this.admin.api.formats,
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
        : this.admin.api.getApiUrl(options)
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

    setupEvents() {
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
            // data changes register, and the form model writes the values that
            // it derives from the data.
            // NOTE: The result of `handleListeners()` is returned as expected.
            this.waitUntilDataModelSettled().then(handleListeners)
          : handleListeners()
      }
    },

    // Waits until the data model settled: its loads finished, and it wrote the
    // values that it derives from the data, e.g. before submitting. Shows the
    // spinner in the header while loads are pending, like requests do, but
    // without disabling the view, as the user may still be editing.
    async waitUntilDataModelSettled() {
      // Write the values that components hold back first, so that the values
      // derived from them follow:
      this.dataModel?.writePendingValues()
      await this.$nextTick()
      const { dataModel } = this
      if (dataModel?.hasPendingLoads) {
        await this.admin.loadingTracker.track(() =>
          dataModel.waitUntilSettled()
        )
      }
    },

    emitSchemaEvent(event, params) {
      return this.schemaComponent.emitEvent(event, params)
    }
  }
}

function getParentComponent(component, key) {
  const current = component[key]
  let parent = component.parentComponent
  while (parent && parent[key] === current) {
    parent = parent.parentComponent
  }
  return parent?.[key] ?? null
}
