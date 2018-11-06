import DitoView from '@/components/DitoView'
import DitoForm from '@/components/DitoForm'
import DitoNestedForm from '@/components/DitoNestedForm'
import DataMixin from './DataMixin'
import { getSchemaAccessor } from '@/utils/accessor'
import { isFullyContained } from '@/utils/string'
import {
  processForms, hasForms, hasLabels, getNamedSchemas,
  isObjectSource, isListSource
} from '@/utils/schema'
import {
  isObject, isArray, isNumber, asArray, parseDataPath, normalizeDataPath, equals
} from '@ditojs/utils'

// @vue/component
export default {
  mixins: [DataMixin],

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

    hasData() {
      return !!this.value
    },

    parentDataComponent() {
      // Used by `shouldLoad()`: Returns the parent `dataRouteComponent`
      // that may load data for this component.
      // We can't return `parentDataRouteComponent` here as in DataMixin,
      // because that would be the parent's parent.
      return this.dataRouteComponent
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

    resource() {
      return { type: 'collection' }
    },

    path() {
      const { isView, path } = this.routeComponent
      return isView ? path : `${path}/${this.schema.path}`
    },

    query: {
      get() {
        return this.getStore('query')
      },

      set(query) {
        // Always keep the displayed query parameters in sync with the stored
        // ones. Use scope and page from the list schema as defaults, but allow
        // the route query parameters to override them.
        const {
          scope = this.defaultScope?.name,
          page = this.schema.page
        } = this.query || {}
        // Preserve / merge currently stored values.
        query = {
          ...(scope != null && { scope }),
          ...(page != null && { page }),
          ...query
        }
        if (!equals(query, this.$route.query)) {
          // Tell the `$route` watcher to ignore the changed triggered here:
          this.ignoreRouteChange = true
          this.$router.replace({ query, hash: this.$route.hash })
        }
        return this.setStore('query', query)
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
          if (scope.default) {
            return scope
          }
          if (!first) {
            first = scope
          }
        }
        return first
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

    paginate: getSchemaAccessor('paginate', { type: Number }),
    inline: getSchemaAccessor('inline', { type: Boolean }),

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
        return editable && !this.inline
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
      const path1 = from.path
      const path2 = to.path
      if (path1 === path2 && from.hash === to.hash) {
        // Paths and hashes remain the same, so only queries have changed.
        // Update filter and reload data without clearing.
        this.query = to.query
        this.loadData(false)
      } else if (!isFullyContained(path1, path2)) {
        // The routes change completely, but we may still be within the same
        // component since tree lists use a part of the path to edit nested
        // data.  Compare against component path to rule out such path changes:
        const { path } = this.routeComponent
        if (!(path1.startsWith(path) && path2.startsWith(path))) {
          // Complete change from one view to the next but TypeList is reused,
          // so clear the filters and load data with clearing.
          this.query = {}
          this.loadData(true)
          this.closeNotifications()
        }
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

    // @override
    clearData() {
      this.total = 0
      this.value = null
    },

    // @override
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
        !this.viewComponent.isSingleComponent
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
          const resource = {
            type: 'member',
            id: this.getItemId(this.schema, item)
          }
          this.request('delete', { resource }, err => {
            if (!err) {
              this.removeItem(item)
              notify(false)
            }
            this.reloadData()
          })
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
    api, schema, name, routes, parentMeta, level,
    nested = false, flatten = false,
    process = null
  ) {
    if (!hasForms(schema)) return
    const path = schema.path = schema.path || api.normalizePath(name)
    schema.name = name
    const { inline } = schema
    if (inline) {
      if (schema.nested === false) {
        throw new Error(
          'Lists with inline forms can only work with nested data')
      }
      schema.nested = true
    }
    // Use differently named url parameters on each nested level for id as
    // otherwise they would clash and override each other inside $route.params
    // See: https://github.com/vuejs/vue-router/issues/1345
    const param = `id${level + 1}`
    const meta = {
      api,
      schema,
      // When children are flattened (tree-lists), reuse the parent meta data,
      // but include the `flatten` setting also.
      flatten
    }
    const formMeta = {
      ...meta,
      nested,
      param
    }
    const childRoutes = await processForms(api, schema, formMeta, level)
    if (process) {
      await process(childRoutes, formMeta, level + 1)
    }
    // Inline forms don't need actually add routes.
    if (!inline) {
      const getPathWithParam = (path, param) => param
        ? path
          ? `${path}/:${param}`
          : `:${param}`
        : path

      const isView = level === 0
      // While lists in views have their own route records, nested lists in
      // forms do not, and need their path prefixed with the parent's path:
      const formPath = isView ? '' : path
      const formRoute = {
        // Object sources don't need id params in their form paths, as they
        // directly edit one object.
        path: getPathWithParam(formPath, isListSource(schema) && param),
        component: nested ? DitoNestedForm : DitoForm,
        meta: formMeta
      }
      const formRoutes = [formRoute]
      // Partition childRoutes into those that need flattening (tree-lists) and
      // those that don't, and process each group separately after.
      const [flatRoutes, subRoutes] = childRoutes.reduce(
        (res, route) => {
          res[route.meta.flatten ? 0 : 1].push(route)
          return res
        },
        [[], []]
      )
      if (flatRoutes.length) {
        for (const childRoute of flatRoutes) {
          formRoutes.push({
            ...(childRoute.redirect ? childRoute : formRoute),
            path: `${formRoute.path}/${childRoute.path}`,
            meta: {
              ...childRoute.meta,
              flatten
            }
          })
        }
      }
      if (subRoutes.length) {
        formRoute.children = subRoutes
      }
      if (isView) {
        routes.push({
          path: `/${path}`,
          children: formRoutes,
          component: DitoView,
          meta
        })
      } else {
        if (isObjectSource(schema)) {
          // Also add a param route, simply to handle '/create' links the same
          // way that lists do, where it overlaps with :id for item ids.
          routes.push({
            ...formRoute,
            path: getPathWithParam(formPath, param)
          })
        } else {
          // Just redirect back to the form when a nested list route is hit.
          routes.push({
            path,
            redirect: '.',
            meta
          })
        }
        // Add the prefixed formRoutes with its children for nested lists.
        routes.push(...formRoutes)
      }
    }
  }
}
