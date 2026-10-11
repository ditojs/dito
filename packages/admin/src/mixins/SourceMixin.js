import ItemMixin from './ItemMixin.js'
import ResourceMixin from './ResourceMixin.js'
import SchemaParentMixin from '../mixins/SchemaParentMixin.js'
import { getSchemaAccessor, getStoreAccessor } from '../utils/accessor.js'
import { getMemberResource } from '../utils/resource.js'
import { ListQuery } from '../utils/ListQuery.js'
import { ItemStores } from '../utils/ItemStores.js'
import {
  isCompact,
  isInlined,
  isObjectSource,
  isListSource
} from '../utils/schema/structure.js'
import { setupForms } from '../utils/schema/setup.js'
import {
  getNamedSchemas,
  getButtonSchemas,
  hasFormSchema,
  getFormSchemas,
  getViewSchema
} from '../utils/schema/lookup.js'
import { updateOrder } from '../utils/schema/data.js'
import { confirmAndRemove } from '../utils/dialogs.js'
import {
  isObject,
  isString,
  isArray,
  isNumber,
  equals,
  parseDataPath
} from '@ditojs/utils'
import { markRaw } from 'vue'
import { appendDataPath, getRelativeDataPath } from '../utils/data.js'

// @vue/component
export default {
  mixins: [ItemMixin, ResourceMixin, SchemaParentMixin],

  defaultValue: context => (isListSource(context.schema) ? [] : null),
  // Exclude all sources that have their own resource handling the data.
  excludeValue: context => !!context.schema.resource,

  provide() {
    return {
      $sourceComponent: () => this
    }
  },

  data() {
    return {
      wrappedPrimitives: null,
      listQuery: markRaw(
        new ListQuery({
          router: this.$router,
          getRoute: () => this.$route,
          getSourceStore: () => this.store,
          getDefaultQuery: () => this.defaultQuery
        })
      ),
      itemStores: ItemStores.getFromStore(this.store)
    }
  },

  computed: {
    sourceComponent() {
      return this
    },

    isObjectSource() {
      return isObjectSource(this.type)
    },

    isListSource() {
      return isListSource(this.type)
    },

    // Required by ResourceMixin, see its contract.
    hasData() {
      return !!this.value
    },

    shouldRender() {
      // Lists with routed forms don't render where the recursion of forms that
      // contain themselves stops, see `maxDepth`. Inlined lists render their
      // data as it is:
      return this.isInlined || !this.sourceNode?.isBeyondMaxDepth
    },

    isReady() {
      // Lists that have no data and no associated resource should still render,
      // as they may be getting their data elsewhere, e.g. `compute()`.
      return (
        this.shouldRender &&
        (this.hasData || !this.providesData)
      )
    },

    isInView() {
      return !!this.viewComponent
    },

    wrapPrimitives() {
      return this.schema.wrapPrimitives
    },

    valueListData() {
      // The list of items held by `value`, before wrapping primitives.
      const { value } = this
      return this.isObjectSource
        ? value != null
          ? [value]
          : []
        : (this.isListResults(value) ? value.results : value) || []
    },

    primitiveValues() {
      // The values of `wrapPrimitives` lists, copied so that changes of their
      // entries are tracked too, see the `primitiveValues` watcher.
      return this.wrapPrimitives ? [...this.valueListData] : null
    },

    listData: {
      get() {
        return this.wrapPrimitives
          ? this.wrappedPrimitives || []
          : this.valueListData
      },

      set(data) {
        if (this.wrapPrimitives) {
          this.wrappedPrimitives = data
        } else {
          this.value = this.isObjectSource
            ? data?.length > 0
              ? data[0]
              : null
            : updateOrder(this.sourceSchema, data, this.paginationRange)
        }
      }
    },

    objectData: {
      get() {
        // Always go through `listData` internally, which does all the
        // processing of `wrapPrimitives`, etc.
        return this.listData[0] || null
      },

      set(data) {
        this.listData = data ? [data] : []
      }
    },

    sourceSchema() {
      // The sourceSchema of a list is the list's schema itself.
      return this.schema
    },

    // The defaults of the query, see `ListQuery`.
    defaultQuery() {
      return {
        scope: this.defaultScope?.name,
        page: this.schema.page,
        order: this.defaultOrder
      }
    },

    query: {
      get() {
        return this.listQuery.query
      },

      // Navigates to the query asynchronously, see `ListQuery.update()`. The
      // stored query and thus the getter only change once the route did, when
      // the `$route` watcher loads the list. Loads requested meanwhile wait
      // for the navigation, see `requestData()`.
      set(query) {
        this.listQuery.update(query)
      }
    },

    total: getStoreAccessor('total'),

    columns() {
      return getNamedSchemas(this.schema.columns)
    },

    scopes() {
      return getNamedSchemas(this.schema.scopes)
    },

    defaultScope() {
      let first = null
      if (this.scopes) {
        for (const scope of Object.values(this.scopes)) {
          if (scope.defaultScope) {
            return scope
          }
          if (!first) {
            first = scope
          }
        }
      }
      return first
    },

    defaultOrder() {
      if (this.columns) {
        for (const column of Object.values(this.columns)) {
          const { defaultSort } = column
          if (defaultSort) {
            const direction = isString(defaultSort) ? defaultSort : 'asc'
            return `${column.name} ${direction}`
          }
        }
      }
      return null
    },

    nestedMeta() {
      return {
        ...this.meta,
        schema: this.schema
      }
    },

    forms() {
      return Object.values(getFormSchemas(this.schema, this.context))
    },

    // Returns the linked view schema if this source edits it its items through
    // a linked view.
    view() {
      return getViewSchema(this.schema, this.context)
    },

    linksToView() {
      return !!this.view
    },

    buttonSchemas() {
      return getButtonSchemas(this.schema.buttons)
    },

    isCompact() {
      return this.forms.every(isCompact)
    },

    isInlined() {
      return isInlined(this.schema)
    },

    paginate: getSchemaAccessor('paginate', {
      type: Number
    }),

    render: getSchemaAccessor('render', {
      type: Function,
      default: null
    }),

    hasItems() {
      // Object sources only have an item to edit or delete once they're set.
      return this.isListSource || !!this.value
    },

    creatable: getSchemaAccessor('creatable', {
      type: Boolean,
      default: false,
      get(creatable) {
        // Lists linked to views create their items in the form of the view:
        return creatable && (hasFormSchema(this.schema) || this.linksToView)
          ? this.isObjectSource
            ? !this.value
            : true
          : false
      }
    }),

    editable: getSchemaAccessor('editable', {
      type: Boolean,
      default: false,
      get(editable) {
        return editable && !this.isInlined && this.hasItems
      }
    }),

    deletable: getSchemaAccessor('deletable', {
      type: Boolean,
      default: false,
      get(deletable) {
        return deletable && this.hasItems
      }
    }),

    draggable: getSchemaAccessor('draggable', {
      type: Boolean,
      default: false,
      get(draggable) {
        return this.isListSource && draggable
      }
    }),

    collapsible: getSchemaAccessor('collapsible', {
      type: Boolean,
      default: false,
      get(collapsible) {
        return collapsible && this.isInlined
      }
    }),

    collapsed: getSchemaAccessor('collapsed', {
      type: Boolean,
      default: false,
      get(collapsed) {
        return collapsed && this.collapsible
      }
    }),

    createPath() {
      return this.creatable
        ? this.linksToView
          ? this.getViewItemPath('create')
          : (this.routeComponent?.getCreatePath(this.dataPath) ?? null)
        : null
    },

    // The path of the form of object sources, which are their own item:
    objectPath() {
      return this.linksToView
        ? this.value &&
          this.getViewItemPath(this.getItemId(this.schema, this.value))
        : this.getFormPath(this.dataPath)
    },

    // The node of the source in the route tree, if it has a route component:
    sourceNode() {
      const { routeComponent } = this
      return (
        routeComponent?.meta.node.findSource(
          getRelativeDataPath(this.dataPath, routeComponent.dataPath)
        ) ?? null
      )
    }
  },

  watch: {
    $route: {
      // https://github.com/vuejs/vue-router/issues/3393#issuecomment-1158470149
      flush: 'post',
      handler(to, from) {
        if (
          this.providesData &&
          // Only the query changed, see `ListQuery`:
          from.path === to.path &&
          from.hash === to.hash &&
          this.listQuery.setFromRoute(to.query)
        ) {
          this.loadData(false)
        }
      }
    },

    value: {
      immediate: true,
      handler(value) {
        // If data gets inherited from parent, unwrapping `{ results, total }`
        // isn't happening at the root in `setData()`, but here instead.
        if (this.isListResults(value)) {
          this.unwrapListData(value)
        }
      }
    },

    primitiveValues: {
      immediate: true,
      handler(values) {
        // Wrap the primitive values in objects for the list's forms to edit,
        // unless they're the values that were just unwrapped from them.
        if (values && !equals(values, this.unwrapPrimitives())) {
          const { wrapPrimitives } = this
          this.wrappedPrimitives = values.map(value => ({
            [wrapPrimitives]: value
          }))
        }
      }
    },

    wrappedPrimitives: {
      deep: true,
      handler() {
        // Map edits of the wrapped primitives back to the primitive values.
        const values = this.unwrapPrimitives()
        if (values && !equals(values, this.primitiveValues)) {
          this.value = values
        }
      }
    }
  },

  methods: {
    // Required by ResourceMixin, see its contract.
    setupData() {
      this.listQuery.syncWithRoute()
      this.ensureData()
    },

    // @override ResourceMixin.requestData()
    requestData() {
      // While a navigation to a changed query is pending, the stored query is
      // stale, and the `$route` watcher loads the list with the new query once
      // the route changed. Wait for it instead of loading the stale query, and
      // only load if the navigation failed or was superseded.
      const navigated = this.listQuery.whenNavigated()
      return navigated
        ? navigated.then(hasNavigated => {
            if (!hasNavigated && !this.$.isUnmounted) {
              return this.requestData()
            }
          })
        : ResourceMixin.methods.requestData.call(this)
    },

    // Required by ResourceMixin, see its contract.
    clearData() {
      this.total = 0
      this.setLoadedValue(null)
    },

    // Required by ResourceMixin, see its contract.
    setData(data) {
      // When new data is loaded, we can store it right back in the data of the
      // view or form that created this list component.
      // Support two formats for list data:
      // - Array: `[...]`
      // - Object: `{ results: [...], total }`, see `unwrapListData()`
      if (this.isListSource && isArray(data)) {
        this.setLoadedListItems(data)
      } else if (!data || this.isObjectSource && isObject(data)) {
        this.setLoadedValue(data)
      } else if (this.unwrapListData(data)) {
        // The format didn't match, see if we received a `{ results, total }`
        // object, in which case `this.value` was already set by
        // `unwrapListData()` and we're done now.
      } else if (isObject(data) && this.isInView) {
        // The controller is sending data for a full multi-component view,
        // including the nested list data.
        return this.viewComponent.setData(data)
      }
      return this.value
    },

    getItemStore(item) {
      return this.itemStores.getStore(this.getItemUid(this.schema, item))
    },

    isListResults(data) {
      // Lists can also be loaded as `{ results, total }`, see `setData()`.
      return (
        this.isListSource &&
        isObject(data) &&
        isNumber(data.total) &&
        isArray(data.results)
      )
    },

    unwrapPrimitives() {
      const { wrapPrimitives, wrappedPrimitives } = this
      return wrapPrimitives && wrappedPrimitives
        ? wrappedPrimitives.map(object => object[wrapPrimitives])
        : null
    },

    unwrapListData(data) {
      if (this.isListResults(data)) {
        // If @ditojs/server sends data in the form of `{ results, total }`
        // replace the value with result, but remember the total in the store.
        this.total = data.total
        this.setLoadedListItems(data.results)
        return this.value
      }
    },

    // Sets the list items loaded through the source's resource, numbered by
    // their order key with the offset of the loaded page, so that their order
    // can be stored even if it never changes, e.g. by a button that saves the
    // current order. Lists in the data of forms, views and dialogs are
    // numbered by `DataModel`, see `initializeData()`.
    setLoadedListItems(items) {
      this.setLoadedValue(
        updateOrder(this.sourceSchema, items, this.paginationRange)
      )
    },

    // Writes the value loaded through the source's resource. Loading isn't an
    // edit of the data, so the value is written as a clean change, which
    // doesn't make the form dirty, e.g. for sources whose value is stored,
    // like the order of their items, see `DataModel.applyCleanChanges()`.
    setLoadedValue(value) {
      this.dataModel
        .applyCleanChanges(() => {
          this.value = value
        })
        .catch(console.error)
    },

    createItem(schema, type, index = null) {
      const item = this.createData(schema, type)
      if (this.isObjectSource) {
        this.objectData = item
      } else {
        const { listData } = this
        if (index != null) {
          listData.splice(index, 0, item)
        } else {
          listData.push(item)
        }
        // Set the list back, as `listData` is a new array for `null` values.
        this.listData = listData
      }
      if (this.collapsible) {
        this.$nextTick(() => this.openSchemaComponent(index ?? -1))
      }
      this.onChange()
      return item
    },

    removeItem(item, index) {
      let removed = false
      if (this.isObjectSource) {
        this.objectData = null
        removed = true
      } else {
        const { listData } = this
        if (index >= 0) {
          listData.splice(index, 1)
          // Set the list back, to update the order of the remaining items.
          this.listData = listData
          removed = true
        }
      }
      if (removed) {
        this.itemStores.removeStore(this.getItemUid(this.schema, item))
        // Items of lists with a resource are deleted through it, see
        // `deleteItem()`, leaving no changes to save behind, but still
        // changing the list.
        if (this.isTransient) {
          this.onChange()
        } else {
          this.emitChangeEvent()
        }
      }
    },

    async deleteItem(item, index) {
      if (!item) return
      const label = this.getItemLabel(this.schema, item, {
        index,
        extended: true
      })
      // Look up the item by identity whenever it's removed, as the data may
      // have changed while the dialog was open or the request was pending.
      // Object sources have no index, see `removeItem()`.
      const getCurrentIndex = () => {
        if (this.isObjectSource) {
          return this.objectData === item ? null : -1
        }
        return this.listData.indexOf(item)
      }
      const removeIfPresent = () => {
        const currentIndex = getCurrentIndex()
        const isPresent = currentIndex !== -1
        if (isPresent) {
          this.removeItem(item, currentIndex)
        }
        return isPresent
      }
      await confirmAndRemove(this, {
        label,
        isTransient: this.isTransient,
        remove: async () => {
          if (this.isTransient) {
            return removeIfPresent()
          }
          const currentIndex = getCurrentIndex()
          if (currentIndex === -1) {
            return false
          }
          const method = 'delete'
          const resource = getMemberResource(
            this.getItemId(this.schema, item, currentIndex),
            this.getResource({ method })
          )
          if (!resource) {
            return false
          }
          let isDeleted = false
          await this.handleRequest({ method, resource }, err => {
            if (!err) {
              removeIfPresent()
              isDeleted = true
            }
            this.reloadData()
          })
          return isDeleted
        }
      })
    },

    getSchemaComponent(index) {
      const { listData, schemaComponents } = this
      const candidate = schemaComponents.at(index)
      if (listData?.length) {
        // Fast path: registration order usually matches `listData`. Fall back
        // to a search by reference when it doesn't (non-tail inserts, drag
        // reorders), since `schemaComponents` is filled by mount-order pushes.
        const item = listData.at(index)
        return item == null
          ? null
          : candidate?.data === item
            ? candidate
            : schemaComponents.find(c => c.data === item)
      }
      return candidate
    },

    openSchemaComponent(index) {
      const schemaComponent = this.getSchemaComponent(index)
      if (schemaComponent) {
        schemaComponent.opened = true
      }
    },

    // See `DitoSchema.navigateToComponent()`, and `shouldRevealInlinedOnly`
    // there.
    async navigateToComponent(
      dataPath,
      onComplete,
      { shouldRevealInlinedOnly = false } = {}
    ) {
      const index = dataPath.startsWith(this.dataPath)
        ? this.isListSource
          ? parseDataPath(dataPath.slice(this.dataPath.length + 1))[0] ?? null
          : 0
        : null
      if (index !== null && isNumber(+index)) {
        // Inlined items reveal the component themselves, opening collapsed
        // items and sections, see `DitoSchema.navigateToComponent()`.
        const schemaComponent = this.getSchemaComponent(+index)
        if (
          await schemaComponent?.navigateToComponent(dataPath, onComplete, {
            shouldRevealInlinedOnly
          })
        ) {
          return true
        }
      }
      return (
        !shouldRevealInlinedOnly &&
        this.navigateToRouteComponent(dataPath, onComplete)
      )
    },

    async navigateToRouteComponent(dataPath, onComplete) {
      const route = this.routeComponent.getFormRoute(dataPath)
      if (route) {
        if (this.$route.path !== route.path) {
          await this.$router.push({ path: route.path })
          // Wait for the route component to be mounted:
          await this.$nextTick()
        }
        const level = this.$route.matched.length - 1
        return onComplete?.([this.appState.routeComponents[level]]) ?? true
      }
      return false
    },

    getItemPath(index) {
      return this.linksToView
        ? this.getViewItemPath(
            this.getItemId(this.schema, this.listData[index], index)
          )
        : this.getFormPath(appendDataPath(this.dataPath, index))
    },

    // Lists linked to views edit their items in the form of the view:
    getViewItemPath(key) {
      const form = this.viewRegistry.routeTree?.getViewForm(this.schema.view)
      return form
        ? this.$router.resolve({
            name: form.routeName,
            params: { [form.param]: key }
          }).path
        : null
    },

    // Resolve the path of the form that edits the item at `dataPath`:
    getFormPath(dataPath) {
      const route = this.routeComponent?.getFormRoute(dataPath)
      return route && !route.dataPath ? route.path : null
    }
  }, // end of `methods`

  async processSchema(api, schema, name) {
    schema.name ??= name
    if (isInlined(schema) && schema.resource) {
      throw new Error(
        `Nested ${
          isListSource(schema)
            ? 'lists'
            : isObjectSource(schema)
              ? 'objects'
              : 'schema'
        } cannot load data from their own resources`
      )
    }
    await setupForms(api, schema)
  },

  processValue({ schema, value, dataPath }, graph) {
    graph.addSource(dataPath, schema)
    // `SchemaGraph.process()` changes the ids of the items in the processed
    // data. The items of sources with forms are processed into copies, but the
    // ones of sources without forms are still the items of the data.
    return hasFormSchema(schema) ? value : copyItems(value)
  }
}

// Returns shallow copies of the items of a list, or of an object.
function copyItems(value) {
  return isArray(value)
    ? value.map(item => (isObject(item) ? { ...item } : item))
    : isObject(value)
      ? { ...value }
      : value
}
