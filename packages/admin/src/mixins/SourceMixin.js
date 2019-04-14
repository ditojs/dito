import DitoComponent from '@/DitoComponent'
import ResourceMixin from './ResourceMixin'
import { getSchemaAccessor } from '@/utils/accessor'
import { getItemParams } from '@/utils/data'
import { getMemberResource } from '@/utils/resource'
import {
  processRouteSchema, processForms, hasForms, hasLabels, getNamedSchemas,
  isObjectSource, isListSource
} from '@/utils/schema'
import {
  isObject, isString, isArray, isNumber, asArray,
  parseDataPath, normalizeDataPath, equals
} from '@ditojs/utils'

// @vue/component
export default {
  mixins: [ResourceMixin],

  defaultValue(schema) {
    return isListSource(schema) ? [] : null
  },

  data() {
    return {
      isSource: true,
      wrappedPrimitives: null,
      unwrappingPrimitives: false,
      ignoreRouteChange: false
    }
  },

  computed: {
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
        data = data || []
        const { wrapPrimitives } = this
        if (wrapPrimitives) {
          if (this.unwrappingPrimitives) {
            // We're done unwrapping once `listData` is reevaluated, so set
            // this to `false` again. See `wrappedPrimitives` watcher above.
            this.unwrappingPrimitives = false
          } else {
            // Convert data to a list of wrapped primitives, and return it.
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
            ? (data ? data[0] : data)
            : data
        }
      }
    },

    objectData: {
      get() {
        // Always go through `listData` internally, which does all the
        // processing of `wrapPrimitives`, etc.
        const { listData } = this
        return listData ? listData[0] : listData
      },

      set(data) {
        this.listData = data ? [data] : data
      }
    },

    sourceSchema() {
      // The sourceSchema of a list is the list's schema itself.
      return this.schema
    },

    path() {
      // This is used in TypeList for DitoFormChooser.
      return this.routeComponent.getChildPath(this.schema)
    },

    defaultQuery() {
      const { defaultOrder: order } = this
      return order ? { order } : {}
    },

    query: {
      get() {
        return {
          ...this.defaultQuery,
          ...this.getStore('query')
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
          // Tell the `$route` watcher to ignore the changed triggered here:
          this.ignoreRouteChange = true
          this.$router.replace({ query, hash: this.$route.hash })
        }
        this.setStore('query', query)
      }
    },

    total: {
      get() {
        return this.getStore('total')
      },

      set(total) {
        return this.setStore('total', total)
      }
    },

    columns() {
      return getNamedSchemas(this.schema.columns)
    },

    scopes() {
      return getNamedSchemas(this.schema.scopes)
    },

    defaultScope() {
      if (this.scopes) {
        let first = null
        for (const scope of Object.values(this.scopes)) {
          if (scope.defaultScope) {
            return scope
          }
          if (!first) {
            first = scope
          }
        }
        return first
      }
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
    },

    nestedMeta() {
      return {
        ...this.meta,
        schema: this.schema
      }
    },

    forms() {
      const { form, forms } = this.schema
      return forms && Object.values(forms) || asArray(form)
    },

    hasLabels() {
      for (const form of this.forms) {
        if (hasLabels(form)) {
          return true
        }
      }
      return false
    },

    isCompact() {
      for (const form of this.forms) {
        if (!form.compact) {
          return false
        }
      }
      return true
    },

    paginate: getSchemaAccessor('paginate', {
      type: Number
    }),

    inlined: getSchemaAccessor('inlined', {
      type: Boolean,
      default: false
    }),

    creatable: getSchemaAccessor('creatable', {
      type: Boolean,
      default: false,
      get(creatable) {
        return creatable && hasForms(this.schema)
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
        return editable && !this.inlined
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
        return draggable && this.isListSource && this.listData.length > 1
      }
    })
  },

  watch: {
    $route(to, from) {
      if (this.ignoreRouteChange) {
        this.ignoreRouteChange = false
        return
      }
      if (from.path === to.path && from.hash === to.hash) {
        // Paths and hashes remain the same, so only queries have changed.
        // Update filter and reload data without clearing.
        this.query = to.query
        this.loadData(false)
      }
    },

    wrappedPrimitives: {
      deep: true,
      handler(newValue, oldValue) {
        const { wrapPrimitives } = this
        // Skip the initial setting of wrappedPrimitives array
        if (wrapPrimitives && oldValue !== null) {
          // Whenever the wrappedPrimitives change, map their values back to
          // the array of primitives, in a primitive way :)
          // But set `unwrappingPrimitives = true`, so the `listData` computed
          // property knows about it, which sets it to `false` again.
          this.unwrappingPrimitives = true
          this.value = newValue.map(object => object[wrapPrimitives])
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
      } else if (
        isObject(data) &&
        this.viewComponent &&
        !this.viewComponent.isSingleComponentView
      ) {
        // The controller is sending data for a full multi-component view,
        // including the nested list data.
        this.viewComponent.data = data
      }
      this.schemaComponent.onLoad()
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

    getDataPath(index) {
      return this.isObjectSource
        // For objects, use no path to list, and normal path to the item:
        ? index == null ? undefined : this.dataPath
        // For lists, use normal path to list, and concatenated path to item:
        : index == null ? this.dataPath : `${this.dataPath}/${index}`
    },

    getEditLink(item, index) {
      return {
        path: this.isObjectSource
          ? this.path
          : `${this.path}/${this.getItemId(this.schema, item, index)}`
      }
    },

    renderItem(item, index) {
      return this.schema.render(getItemParams(this, {
        name: undefined,
        value: undefined,
        data: item,
        dataPath: this.getDataPath(index)
      }))
    },

    createItem(schema, type) {
      const item = this.createData(schema, type)
      if (this.isObjectSource) {
        this.objectData = item
      } else {
        this.listData.push(item)
      }
      this.onChange()
      return item
    },

    removeItem(item) {
      if (this.isObjectSource) {
        this.objectData = null
        this.onChange()
      } else {
        const { listData } = this
        const index = listData && listData.indexOf(item)
        if (index >= 0) {
          listData.splice(index, 1)
          this.onChange()
        }
      }
    },

    deleteItem(item, index) {
      const label = item && this.getItemLabel(this.schema, item, index, true)

      const notify = transient => this.notify(transient ? 'info' : 'success',
        'Successfully Removed', `${label} was ${this.verbs.deleted}.`)

      if (item && confirm(
        `Do you really want to ${this.verbs.delete} ${label}?`)
      ) {
        if (this.isTransient) {
          this.removeItem(item)
          notify(true)
        } else {
          const itemId = this.getItemId(this.schema, item)
          const resource = getMemberResource(itemId, this.resource)
          if (resource) {
            this.request('delete', { resource }, err => {
              if (!err) {
                this.removeItem(item)
                notify(false)
              }
              this.reloadData()
            })
          }
        }
      }
    },

    navigateToComponent(dataPath, onComplete) {
      const dataPathParts = parseDataPath(dataPath)
      // See if we can find a route that can serve part of the given dataPath,
      // and take it from there:
      while (dataPathParts.length > 0) {
        const path = this.api.normalizePath(normalizeDataPath(dataPathParts))
        const location = `${this.$route.path}/${path}`
        const { matched } = this.$router.match(location)
        if (matched.length) {
          this.$router.push({ path: location, append: true }, route => {
            if (onComplete) {
              const { matched } = route
              onComplete(matched[matched.length - 1])
            }
          })
          return true
        }
        // Keep removing the last part until we find a match.
        dataPathParts.pop()
      }
      return false
    }
  }, // end of `methods`

  async processSchema(
    api, schema, name, routes, level,
    nested = false, flatten = false,
    process = null
  ) {
    if (!hasForms(schema)) return
    processRouteSchema(api, schema, name)
    if (schema.inlined && schema.resource) {
      throw new Error(
        'Lists with nested forms cannot load data from their own resources'
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
    // Inline forms don't need to actually add routes.
    if (!schema.inlined) {
      const getPathWithParam = (path, param) => param
        ? path
          ? `${path}/:${param}`
          : `:${param}`
        : path

      // Lists in single-component-views (level === 0) use their view's path,
      // while all others need their path prefixed with the parent's path:
      const sourcePath = level === 0 ? '' : schema.path
      const formRoute = {
        // Object sources don't need id params in their form paths, as they
        // directly edit one object.
        path: getPathWithParam(sourcePath, isListSource(schema) && param),
        component: DitoComponent.component(
          nested ? 'dito-form-nested' : 'dito-form'
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
  }
}
