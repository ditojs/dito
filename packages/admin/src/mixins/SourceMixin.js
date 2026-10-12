import ItemMixin from './ItemMixin.js'
import ResourceMixin from './ResourceMixin.js'
import SchemaParentMixin from '../mixins/SchemaParentMixin.js'
import { getSchemaAccessor, getStoreAccessor } from '../utils/accessor.js'
import { getResource, getMemberResource } from '../utils/resource.js'
import { ListQuery } from '../utils/ListQuery.js'
import { ItemStores } from '../utils/ItemStores.js'
import { SourceContext } from '../utils/SourceContext.ts'
import DitoContext from '../DitoContext.js'
import {
  isCompact,
  isInlined,
  isObjectSource,
  isListSource
} from '../utils/schema/structure.js'
import {
  getNamedSchemas,
  getButtonSchemas,
  hasFormSchema,
  getFormSchemas,
  getViewSchema
} from '../utils/schema/lookup.js'
import { updateOrder } from '../utils/schema/data.js'
import { getItemAdapter } from '../utils/schema/types.ts'
import { confirmAndRemove } from '../utils/dialogs.js'
import {
  isObject,
  isString,
  isArray,
  isNumber,
  equals,
  parseDataPath
} from '@ditojs/utils'
import { getCurrentInstance, markRaw } from 'vue'
import { appendDataPath, getRelativeDataPath } from '../utils/data.js'
import { useServices } from '../composables/useSchemaContext.ts'

// @vue/component
export default {
  mixins: [ItemMixin, ResourceMixin, SchemaParentMixin],

  provide() {
    return {
      source: this.ownSource
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
      itemStores: ItemStores.getFromStore(this.store),
      ownSource: markRaw(new SourceContext(this))
    }
  },

  computed: {
    isObjectSource() {
      return isObjectSource(this.schema.type)
    },

    isListSource() {
      return isListSource(this.schema.type)
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
      return !!this.route && !this.route.isForm
    },

    itemAdapter() {
      return getItemAdapter(this.schema)
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
      // The values of lists with an item adapter, copied so that changes of
      // their entries are tracked too, see the `primitiveValues` watcher.
      return this.itemAdapter ? [...this.valueListData] : null
    },

    listData: {
      get() {
        return this.itemAdapter
          ? this.wrappedPrimitives || []
          : this.valueListData
      },

      set(data) {
        if (this.itemAdapter) {
          this.wrappedPrimitives = data
        } else {
          this.value = this.isObjectSource
            ? data?.length > 0
              ? data[0]
              : null
            : updateOrder(this.sourceSchema, data)
        }
      }
    },

    // The list for the change API of the data model, see `ListEntry`:
    listEntry() {
      const { schema, listData: list, dataPath } = this
      return { schema, list, dataPath }
    },

    objectData: {
      get() {
        // Always go through `listData` internally, which does all the
        // wrapping of the items, etc.
        return this.listData[0] || null
      },

      set(data) {
        this.listData = data ? [data] : []
      }
    },

    // @override SchemaParentMixin.sourceSchema()
    sourceSchema() {
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
          : (this.route?.getCreatePath(this.dataPath) ?? null)
        : null
    },

    // The path of the form of object sources, which are their own item:
    objectPath() {
      return this.linksToView
        ? this.value &&
          this.getViewItemPath(this.getItemId(this.schema, this.value))
        : (this.route?.getFormPath(this.dataPath) ?? null)
    },

    // The node of the source in the route tree, if it has a route:
    sourceNode() {
      const { route } = this
      return (
        route?.node.findSource(
          getRelativeDataPath(this.dataPath, route.dataPath)
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
          this.wrappedPrimitives = values.map(this.itemAdapter.wrap)
        }
      }
    },

    wrappedPrimitives: {
      deep: true,
      handler() {
        // Map edits of the wrapped primitives back to the primitive values, in
        // place, as the list holds the errors of its values:
        const values = this.unwrapPrimitives()
        const list = this.value
        if (values && !equals(values, this.primitiveValues)) {
          if (isArray(list)) {
            if (values.length === list.length) {
              values.forEach((value, index) => {
                this.dataModel.set(list, index, value)
              })
            } else {
              this.dataModel.replaceItems(
                { schema: this.schema, list, dataPath: this.dataPath },
                values
              )
            }
          } else {
            this.value = values
          }
        }
      }
    }
  },

  created() {
    this.route?.registerSource(this.ownSource, true)
  },

  unmounted() {
    this.route?.registerSource(this.ownSource, false)
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
        return this.route.container.replaceItem(data)
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
      const { itemAdapter, wrappedPrimitives } = this
      return itemAdapter && wrappedPrimitives
        ? wrappedPrimitives.map(itemAdapter.unwrap)
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

    // Number the loaded items by their order key from the offset of the page,
    // so that their order can be stored even if it never changes, e.g. by a
    // button that saves the current order.
    setLoadedListItems(items) {
      this.setLoadedValue(
        updateOrder(this.sourceSchema, items, this.paginationRange?.[0])
      )
    },

    // Writes the value loaded through the source's resource directly, as
    // loading isn't an edit, and replaces the source's changes.
    setLoadedValue(value) {
      this.data[this.schema.name] = value
      this.dataModel.markClean({ dataPath: this.dataPath })
    },

    async submit(button) {
      // Wait for the data that's still loading, e.g. uploads, like forms do:
      await this.waitUntilDataModelSettled()
      const { editCount } = this.dataModel
      let { resource } = button.schema
      resource = getResource(resource, {
        parent: this.getResource({
          method: resource?.method,
          child: resource
        })
      })
      if (resource) {
        const { method } = resource
        const data = this.getPayloadData(button, method)
        const isSuccessful = await this.submitResource(
          button,
          resource,
          method,
          data
        )
        if (isSuccessful) {
          // The source saved its own changes, e.g. the order of its items,
          // which clears their errors, like saving forms does:
          this.dataModel.markClean({ dataPath: this.dataPath, editCount })
          this.dataModel.clearErrors(this.dataPath)
        }
        return isSuccessful
      }
      return false
    },

    // Required by ResourceMixin, see its contract. The buttons of sources
    // submit the source's data.
    showValidationErrors(errors) {
      return this.schemaComponent.showValidationErrors(errors, this.dataPath)
    },

    createItem(schema, type, index = null) {
      const item = this.createData(schema, type)
      if (this.isObjectSource) {
        this.objectData = item
      } else if (this.value) {
        const { listEntry } = this
        this.dataModel.insert(
          listEntry,
          index ?? listEntry.list.length,
          item
        )
      } else {
        // Lists that are `null` have no array to insert into yet:
        this.listData = [item]
      }
      if (this.collapsible) {
        this.$nextTick(() => this.openSchemaComponent(index ?? -1))
      }
      this.onChange()
      return item
    },

    removeItem(item, index) {
      if (this.isObjectSource || index >= 0) {
        this.itemStores.removeStore(this.getItemUid(this.schema, item))
        // Sources with a resource delete the item through it, not as an edit:
        if (this.isObjectSource) {
          if (this.isTransient) {
            this.objectData = null
          } else {
            this.data[this.schema.name] = null
          }
        } else {
          this.dataModel.remove(this.listEntry, index)
          if (!this.isTransient) {
            this.dataModel.markClean({ dataPath: this.dataPath })
          }
        }
        this.onChange()
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

    // Reveals the components of the inlined item that display the value at
    // `dataPath`, see `DitoSchema.revealComponents()`.
    async revealComponents(dataPath) {
      const index = dataPath.startsWith(this.dataPath)
        ? this.isListSource
          ? parseDataPath(dataPath.slice(this.dataPath.length + 1))[0] ?? null
          : 0
        : null
      const schemaComponent =
        index !== null && isNumber(+index)
          ? this.getSchemaComponent(+index)
          : null
      return (await schemaComponent?.revealComponents(dataPath)) ?? []
    },

    getItemPath(index) {
      const dataPath = appendDataPath(this.dataPath, index)
      return this.linksToView
        ? this.getViewItemPath(
            this.getItemId(this.schema, this.listData[index], index)
          )
        : (this.route?.getFormPath(dataPath) ?? null)
    },

    // The label that `DitoSourceItem` shows for `item`:
    getSourceItemLabel(item, index = null) {
      if (this.isInlined) {
        // Inlined items show the label in their schema, but only in lists and
        // collapsible objects:
        return this.isListSource || this.collapsible
          ? this.getItemLabel(this.schema, item, { index, asObject: true })
          : null
      } else {
        return this.render
          ? this.render(
              new DitoContext(this, {
                data: item,
                value: item,
                index,
                dataPath: this.getItemDataPath(this.schema, index)
              })
            )
          : this.getItemLabel(this.schema, item, { index })
      }
    },

    // Lists linked to views edit their items in the form of the view:
    getViewItemPath(key) {
      const route = this.admin.routeTree?.getViewItemRoute(
        this.schema.view,
        key
      )
      return route ? this.$router.resolve(route).path : null
    }
  } // end of `methods`
}

// The services of the types that use the mixin, which own their source and
// resource contexts, for their `setup()`:
export function useSourceServices() {
  const component = getCurrentInstance().proxy
  return useServices({
    get source() {
      return component.ownSource
    },

    get resource() {
      return component.ownResource
    }
  })
}
