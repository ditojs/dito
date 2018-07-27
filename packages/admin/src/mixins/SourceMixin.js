import DitoView from '@/components/DitoView'
import DitoForm from '@/components/DitoForm'
import DitoNestedForm from '@/components/DitoNestedForm'
import DataMixin from './DataMixin'
import { isObject, isArray, parseDataPath } from '@ditojs/utils'
import { getSchemaAccessor } from '@/utils/accessor'
import {
  processForms, hasForms, isObjectSource, isListSource
} from '@/utils/schema'

export default {
  mixins: [DataMixin],

  defaultValue(schema) {
    return isListSource(schema) ? [] : null
  },

  data() {
    return {
      isSource: true
    }
  },

  created() {
    // Make sure filters are set correctly before initData() triggers request.
    this.addQuery(this.$route.query)
  },

  watch: {
    $route(to, from) {
      let path1 = from.path
      let path2 = to.path
      if (path2.length < path1.length) {
        [path1, path2] = [path2, path1]
      }
      // See if the routes changes completely.
      if (!path2.startsWith(path1)) {
        // The paths change, but we may still be within the same component since
        // tree lists use a part of the path to edit nested data.
        // Compare against component path to rule out such path changes:
        const { path } = this.routeComponent
        if (!(path1.startsWith(path) && path2.startsWith(path))) {
          // Complete change from one view to the next but TypeList is reused,
          // so clear the filters and load data with clearing.
          this.setQuery({})
          this.loadData(true)
          this.closeNotifications()
        }
      } else if (path1 === path2 && from.hash === to.hash) {
        // Paths and hashes remain the same, so only queries have changed.
        // Update filter and reload data without clearing.
        this.addQuery(to.query)
        this.loadData(false)
      }
    }
  },

  computed: {
    isObjectSource() {
      return isObjectSource(this.type)
    },

    isListSource() {
      return isListSource(this.type)
    },

    listData() {
      let data = this.value
      if (this.isObjectSource) {
        // Convert to list array.
        data = data != null ? [data] : []
      } else if (isObject(data)) {
        // If @ditojs/server sends data in the form of `{ results, total }`
        // replace the value with result, but remember the total in the store.
        this.setStore('total', data.total)
        this.value = data = data.results
      }
      return data || []
    },

    shouldLoad() {
      // If the route-component (view, form) that this list belongs to also
      // loads data, depend on this first.
      const { routeComponent } = this
      return !this.isTransient && !this.loading && !this.value &&
        !(routeComponent.shouldLoad || routeComponent.loading)
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

    query() {
      return this.getStore('query')
    },

    total() {
      return this.getStore('total')
    },

    columns() {
      return this.getNamedSchemas(this.schema.columns)
    },

    scopes() {
      return this.getNamedSchemas(this.schema.scopes)
    },

    filters() {
      return this.getNamedSchemas(this.schema.filters)
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

  methods: {
    setQuery(query) {
      // Always keep the displayed query parameters in sync with the store.
      // Use scope and page from the list schema as defaults, but allow the
      // route query parameters to override them.
      const { store } = this
      // Preserve / merge currently stored values
      const scope = store.query?.scope || this.defaultScope?.name
      const page = store.query?.page || this.schema.page
      query = {
        ...(scope != null && { scope }),
        ...(page != null && { page }),
        ...query
      }
      this.$router.replace({ query, hash: this.$route.hash })
      this.setStore('query', query)
    },

    addQuery(query) {
      this.setQuery({ ...this.query, ...query })
    },

    setData(data) {
      // When new data is loaded, we can store it right back in the data of the
      // view or form that created this list component.
      // Support two formats for list data:
      // - Array: `[...]`
      // - Object: `{ results: [...], total }`
      if (isArray(data) || isObject(data) && data.results) {
        // NOTE: Conversion of object format happens in `listData()`, so the
        // same format can be returned in controllers that return data for the
        // full view, see below.
        this.value = data
      } else if (this.routeComponent.isView) {
        // The controller is sending data for the view, including the list data.
        this.routeComponent.data = data
      }
    },

    getDataPath(index) {
      return this.isObjectSource
        ? this.dataPath
        : `${this.dataPath}/${index}`
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
        this.value = item
      } else {
        this.value.push(item)
      }
      return item
    },

    removeItem(item) {
      if (this.isObjectSource) {
        this.value = null
      } else {
        const list = this.value
        const index = list && list.indexOf(item)
        if (index >= 0) {
          list.splice(index, 1)
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
      // Use collection/id pairs (even numbers of parts) to determine the route.
      // What's left is the property dataPath, and will be handled by the form.
      const property = dataPathParts.length & 1 ? dataPathParts.pop() : null
      const path = this.api.normalizePath(dataPathParts.join('/'))
      const location = `${this.$route.path}/${path}`
      const { matched } = this.$router.match(location)
      if (matched.length) {
        this.$router.push({ path: location, append: true }, route => {
          if (onComplete) {
            onComplete(route, property)
          }
        })
        return true
      }
      return false
    }
  }, // end of `methods`

  async processSchema(
    api, schema, name, routes, parentMeta, level,
    nested = false, flatten = false,
    process = null
  ) {
    const path = schema.path = schema.path || api.normalizePath(name)
    schema.name = name
    const { inline } = schema
    const addRoutes = !inline
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
    if (addRoutes) {
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
