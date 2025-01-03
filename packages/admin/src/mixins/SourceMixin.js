import DitoComponent from '../DitoComponent.js'
import ItemMixin from './ItemMixin.js'
import ResourceMixin from './ResourceMixin.js'
import SchemaParentMixin from '../mixins/SchemaParentMixin.js'
import { getSchemaAccessor, getStoreAccessor } from '../utils/accessor.js'
import { getMemberResource } from '../utils/resource.js'
import { replaceRoute } from '../utils/route.js'
import {
  processRouteSchema,
  processForms,
  getNamedSchemas,
  getButtonSchemas,
  hasFormSchema,
  getFormSchemas,
  getViewSchema,
  isCompact,
  isInlined,
  isObjectSource,
  isListSource
} from '../utils/schema.js'
import {
  isObject,
  isString,
  isArray,
  isNumber,
  equals,
  parseDataPath,
  normalizeDataPath
} from '@ditojs/utils'
import { raw } from '@ditojs/ui'

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
      unwrappingPrimitives: raw(false)
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

    // @override ResourceMixin.hasData()
    hasData() {
      return !!this.value
    },

    shouldRender() {
      return this.sourceDepth < this.maxDepth
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

    listData: {
      get() {
        let data = this.value
        if (this.isObjectSource) {
          // Convert to list array.
          data = data != null ? [data] : []
        } else {
          // If data gets inherited from parent, unwrapping is not happening
          // at the root in `setData()`, but here instead.
          data = this.unwrapListData(data) || data
        }
        data ||= []
        const { wrapPrimitives } = this
        if (wrapPrimitives) {
          if (this.unwrappingPrimitives.value) {
            // We're done unwrapping once `listData` is reevaluated, so set
            // this to `false` again. See `wrappedPrimitives` watcher above.
            // TODO: Fix side-effects
            // eslint-disable-next-line max-len
            // eslint-disable-next-line vue/no-side-effects-in-computed-properties
            this.unwrappingPrimitives.value = false
          } else {
            // Convert data to a list of wrapped primitives, and return it.
            // TODO: Fix side-effects
            // eslint-disable-next-line max-len
            // eslint-disable-next-line vue/no-side-effects-in-computed-properties
            this.wrappedPrimitives = data.map(value => ({
              [wrapPrimitives]: value
            }))
          }
          return this.wrappedPrimitives
        }
        return data
      },

      set(data) {
        if (this.wrapPrimitives) {
          this.wrappedPrimitives = data
        } else {
          this.value = this.isObjectSource
            ? data && data.length > 0
              ? data[0]
              : null
            : data
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

    sourceDepth() {
      return this.$route.matched.reduce(
        (depth, record) => (
          depth + (record.meta.schema === this.sourceSchema ? 1 : 0)
        ),
        0
      )
    },

    path() {
      // This is used in TypeList for DitoFormChooser.
      return this.routeComponent.getChildPath(this.schema.path)
    },

    defaultQuery() {
      const { defaultOrder: order } = this
      return order ? { order } : {}
    },

    query: getStoreAccessor('query', {
      get(query) {
        return {
          ...this.defaultQuery,
          ...query
        }
      },

      set(query) {
        // Always keep the displayed query parameters in sync with the stored
        // ones. Use scope and page from the list schema as defaults, but allow
        // the route query parameters to override them.
        const {
          scope = this.defaultScope?.name,
          page = this.schema.page
        } = this.query
        // Preserve / merge currently stored values.
        query = {
          ...this.query,
          ...(scope != null && { scope }),
          ...(page != null && { page }),
          ...query
        }
        if (!equals(query, this.$route.query)) {
          // Change the route query parameters, but don't trigger a route
          // change, as that would cause the list to reload.
          replaceRoute({ query })
        }
        return query // Let getStoreAccessor() do the actual setting
      }
    }),

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

    creatable: getSchemaAccessor('creatable', {
      type: Boolean,
      default: false,
      get(creatable) {
        return creatable && hasFormSchema(this.schema)
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
        return editable && !this.isInlined
      }
    }),

    deletable: getSchemaAccessor('deletable', {
      type: Boolean,
      default: false
    }),

    draggable: getSchemaAccessor('draggable', {
      type: Boolean,
      default: false,
      get(draggable) {
        return this.isListSource && this.listData.length > 1 && draggable
      }
    }),

    collapsible: getSchemaAccessor('collapsible', {
      type: Boolean,
      default: null, // so that `??` below can do its thing:
      get(collapsible) {
        return this.isInlined && !!(collapsible ?? this.collapsed !== null)
      }
    }),

    collapsed: getSchemaAccessor('collapsed', {
      type: Boolean,
      default: false,
      get(collapsed) {
        return collapsed && this.collapsible
      }
    }),

    maxDepth: getSchemaAccessor('maxDepth', {
      type: Number,
      default: 1
    })
  },

  watch: {
    $route: {
      // https://github.com/vuejs/vue-router/issues/3393#issuecomment-1158470149
      flush: 'post',
      handler(to, from) {
        if (this.providesData) {
          if (
            from.path === to.path &&
            from.hash === to.hash
          ) {
            // Paths and hashes remain the same, so only queries have changed.
            // Update filter and reload data without clearing.
            this.query = to.query
            this.loadData(false)
          } else if (
            this.meta.reload &&
            from.path !== to.path &&
            from.path.startsWith(to.path)
          ) {
            // Reload the source when navigating back to a parent-route after
            // changing data in a child-route.
            this.meta.reload = false
            this.loadData(false)
          }
        }
      }
    },

    wrappedPrimitives: {
      deep: true,
      handler(to, from) {
        const { wrapPrimitives } = this
        // Skip the initial setting of wrappedPrimitives array
        if (wrapPrimitives && from !== null) {
          // Whenever the wrappedPrimitives change, map their values back to the
          // array of primitives, in a primitive way :)
          // But set `unwrappingPrimitives` to true, so the `listData` computed
          // property knows about it, which sets it to `false` again.
          this.unwrappingPrimitives.value = true
          this.value = to.map(object => object[wrapPrimitives])
        }
      }
    }
  },

  methods: {
    setupData() {
      this.query = this.$route.query
      this.ensureData()
    },

    // @override ResourceMixin.clearData()
    clearData() {
      this.total = 0
      this.value = null
    },

    // @override ResourceMixin.setData()
    setData(data) {
      // When new data is loaded, we can store it right back in the data of the
      // view or form that created this list component.
      // Support two formats for list data:
      // - Array: `[...]`
      // - Object: `{ results: [...], total }`, see `unwrapListData()`
      if (
        !data ||
        this.isListSource && isArray(data) ||
        this.isObjectSource && isObject(data)
      ) {
        this.value = data
      } else if (this.unwrapListData(data)) {
        // The format didn't match, see if we received a `{ results, total }`
        // object, in which case `this.value` was already set by
        // `unwrapListData()` and we're done now.
      } else if (isObject(data) && this.isInView) {
        // The controller is sending data for a full multi-component view,
        // including the nested list data.
        this.viewComponent.setData(data)
      }
    },

    unwrapListData(data) {
      if (
        this.isListSource &&
        isObject(data) &&
        isNumber(data.total) &&
        isArray(data.results)
      ) {
        // If @ditojs/server sends data in the form of `{ results, total }`
        // replace the value with result, but remember the total in the store.
        this.total = data.total
        this.value = data.results
        return this.value
      }
    },

    createItem(schema, type) {
      const item = this.createData(schema, type)
      if (this.isObjectSource) {
        this.objectData = item
      } else {
        this.listData.push(item)
      }
      if (this.collapsible) {
        this.$nextTick(() => this.openSchemaComponent(-1))
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
          removed = true
        }
      }
      if (removed) {
        this.removeItemStore(this.schema, item, index)
        this.onChange()
      }
    },

    deleteItem(item, index) {
      const label = (
        item &&
        this.getItemLabel(this.schema, item, {
          index,
          extended: true
        })
      )

      const notify = () =>
        this.notify({
          type: this.isTransient ? 'info' : 'success',
          title: 'Successfully Removed',
          text: [
            `${label} was ${this.verbs.deleted}.`,
            this.transientNote
          ]
        })

      if (
        item &&
        window.confirm(
          `Do you really want to ${this.verbs.delete} ${label}?`
        )
      ) {
        if (this.isTransient) {
          this.removeItem(item, index)
          notify()
        } else {
          const itemId = this.getItemId(this.schema, item, index)
          const method = 'delete'
          const resource = getMemberResource(
            itemId,
            this.getResource({ method })
          )
          if (resource) {
            this.handleRequest({ method, resource }, err => {
              if (!err) {
                this.removeItem(item, index)
                notify()
              }
              this.reloadData()
            })
          }
        }
      }
    },

    getSchemaComponent(index) {
      const { schemaComponents } = this
      const { length } = schemaComponents
      return schemaComponents[((index % length) + length) % length]
    },

    openSchemaComponent(index) {
      const schemaComponent = this.getSchemaComponent(index)
      if (schemaComponent) {
        schemaComponent.opened = true
      }
    },

    async navigateToComponent(dataPath, onComplete) {
      if (this.collapsible) {
        const index = dataPath.startsWith(this.dataPath)
          ? this.isListSource
            ? parseDataPath(dataPath.slice(this.dataPath.length + 1))[0] ?? null
            : 0
          : null
        if (index !== null && isNumber(+index)) {
          const schemaComponent = this.getSchemaComponent(+index)
          if (schemaComponent) {
            const { opened } = schemaComponent
            if (!opened) {
              schemaComponent.opened = true
              await this.$nextTick()
            }
            const components = schemaComponent.getComponentsByDataPath(dataPath)
            if (components.length > 0 && (onComplete?.(components) ?? true)) {
              return true
            } else {
              schemaComponent.opened = opened
            }
          }
        }
      }
      return this.navigateToRouteComponent(dataPath, onComplete)
    },

    navigateToRouteComponent(dataPath, onComplete) {
      return new Promise((resolve, reject) => {
        const callOnComplete = () => {
          // Retrieve the last route component, which will be the component that
          // we just navigated to, and pass it on to `onComplete()`
          const { routeComponents } = this.appState
          const routeComponent = routeComponents[routeComponents.length - 1]
          resolve(onComplete?.([routeComponent]) ?? true)
        }

        const dataPathParts = parseDataPath(dataPath)
        // See if we can find a route that can serve part of the given dataPath,
        // and take it from there:
        while (dataPathParts.length > 0) {
          const path = this.routeComponent.getChildPath(
            this.api.normalizePath(normalizeDataPath(dataPathParts))
          )
          // See if there actually is a route for this sub-component:
          const { matched } = this.$router.resolve(path)
          if (matched.length && matched[0].name !== 'catch-all') {
            if (this.$route.path === path) {
              // We're already there, so just call `onComplete()`:
              callOnComplete()
            } else {
              // Navigate to the component's path, then call `onComplete()`_:
              this.$router
                .push({ path })
                .catch(reject)
                // Wait for the last route component to be mounted in the next
                // tick before calling `onComplete()`
                .then(() => {
                  this.$nextTick(callOnComplete)
                })
            }
            return
          }
          // Keep removing the last part until we find a match.
          dataPathParts.pop()
        }
        resolve(false)
      })
    }
  }, // end of `methods`

  async processSchema(
    api,
    schema,
    name,
    routes,
    level,
    nested = false,
    flatten = false,
    process = null
  ) {
    processRouteSchema(api, schema, name)
    const inlined = isInlined(schema)
    if (inlined && schema.resource) {
      throw new Error(
        `Nested ${
          this.isListSource
            ? 'lists'
            : this.isObjectSource
              ? 'objects'
              : 'schema'
        } cannot load data from their own resources`
      )
    }
    // Use differently named url parameters on each nested level for id as
    // otherwise they would clash and override each other inside $route.params
    // See: https://github.com/vuejs/vue-router/issues/1345
    const param = `id${level + 1}`
    const meta = {
      api,
      schema
    }
    const formMeta = {
      ...meta,
      // When children are flattened (e.g. tree-lists), include the `flatten`
      // setting also, for flattening below.
      flatten,
      nested,
      param
    }
    const childRoutes = await processForms(api, schema, level)
    if (process) {
      await process(childRoutes, level + 1)
    }
    // Inlined forms don't need to actually add routes.
    if (hasFormSchema(schema) && !inlined) {
      // Lists in single-component-views (level === 0) use their view's path,
      // while all others need their path prefixed with the parent's path:
      const sourcePath = level === 0 ? '' : schema.path
      const formRoute = {
        path: getPathWithParam(
          sourcePath,
          // Object sources don't need id params in their form paths, as they
          // directly edit one object.
          isListSource(schema) ? param : null
        ),
        component: DitoComponent.component(
          nested ? 'DitoFormNested' : 'DitoForm'
        ),
        meta: formMeta
      }
      if (isObjectSource(schema)) {
        // Also add a param route, simply to handle '/create' links the same
        // way that lists do, where it overlaps with :id for item ids.
        routes.push({
          ...formRoute,
          path: getPathWithParam(sourcePath, param)
        })
      }
      if (sourcePath) {
        // Just redirect back to the parent when a nested source route is hit.
        routes.push({
          path: sourcePath,
          redirect: '.',
          meta
        })
      }
      // Partition childRoutes into those that need flattening (e.g. tree-lists)
      // and those that don't, and process each group separately after.
      const [flatRoutes, subRoutes] = childRoutes.reduce(
        (res, route) => {
          res[route.meta.flatten ? 0 : 1].push(route)
          return res
        },
        [[], []]
      )
      if (subRoutes.length) {
        formRoute.children = subRoutes
      }
      routes.push(formRoute)
      // Add the prefixed formRoutes with their children for nested lists.
      if (flatRoutes.length) {
        for (const childRoute of flatRoutes) {
          routes.push({
            ...(childRoute.redirect ? childRoute : formRoute),
            path: `${formRoute.path}/${childRoute.path}`,
            meta: {
              ...childRoute.meta,
              flatten
            }
          })
        }
      }
    }
  },

  processValue({ schema, value, dataPath }, graph) {
    graph.addSource(dataPath, schema)
    return value
  }
}

function getPathWithParam(path, param) {
  return param
    ? path
      ? `${path}/:${param}`
      : `:${param}`
    : path
}
