import { isFunction, labelize } from '@ditojs/utils'
import appState from '../appState.js'
import DitoContext from '../DitoContext.js'
import verbs from '../verbs.js'
import EmitterMixin from './EmitterMixin.js'
import { getSchemaEventEntries } from '../utils/schema/events.js'
import { getSchemaValue, shouldRenderSchema } from '../utils/schema/data.js'
import {
  getResourceUrl,
  sendRequest,
  request,
  format,
  download
} from '../utils/services.ts'
import { appendDataPath, getRelativeDataPath } from '../utils/data.js'
import { reactive } from 'vue'

// @vue/component
export default {
  mixins: [EmitterMixin],

  inject: {
    admin: 'admin',
    $parentComponent: '$parentComponent',
    $schemaComponent: '$schemaComponent',
    $tabComponent: '$tabComponent',
    // The contexts that the closest owners above provide, which the component
    // sees unless it owns them:
    parentContainer: 'container',
    parentRoute: 'route',
    parentSource: 'source',
    parentResource: 'resource'
  },

  provide() {
    return {
      $parentComponent: () => this
    }
  },

  data() {
    return {
      appState,
      isMounted: false,
      overrides: null, // See accessor.js
      // The data model and the contexts that the component owns, if any:
      ownDataModel: null,
      ownContainer: null,
      ownRoute: null,
      ownSource: null,
      ownResource: null
    }
  },

  computed: {
    // The context of the data that the component displays: its own, e.g. of a
    // form, view, dialog or panel with its own data, or else the one above:
    container() {
      return this.ownContainer ?? this.parentContainer
    },

    // The context of the view or form that renders the component, or that the
    // component is:
    route() {
      return this.ownRoute ?? this.parentRoute
    },

    // The context of the list, object or tree that the component is, or that
    // displays it. Views provide the one of their main component:
    source() {
      return this.ownSource ?? this.parentSource
    },

    // The context of the form or source that the component is, or that
    // renders it, which submits its data and resolves its resources. Views
    // provide the one of their main component:
    resource() {
      return this.ownResource ?? this.parentResource
    },

    dataModel() {
      return this.ownDataModel ?? this.parentContainer?.model ?? null
    },

    verbs() {
      return this.resource?.verbs ?? verbs
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

    tabComponent() {
      return this.$tabComponent()
    },

    parentSchemaComponent() {
      return getParentComponent(this, 'schemaComponent')
    },

    // The data that the data paths of the route are relative to, e.g. the
    // data of the view, or the draft root of a nested form, see
    // `DitoView.rootData()` and `DitoForm.rootData()`:
    rootData() {
      return this.route?.rootData
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

    getResourceUrl(resource) {
      return getResourceUrl(this, resource)
    },

    sendRequest(options) {
      return sendRequest(this, options)
    },

    request(options) {
      return request(this, options)
    },

    format(value, options) {
      return format(this, value, options)
    },

    async navigate(location) {
      return this.$router.push(location)
    },

    download(options) {
      download(this, options)
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
