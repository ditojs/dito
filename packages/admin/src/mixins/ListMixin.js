import DataMixin from '@/mixins/DataMixin'
import { isObject, isArray, escapeHtml, camelize, labelize } from '@/utils'

export default {
  mixins: [DataMixin],

  data() {
    return {
      isList: true
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
      if (path2.indexOf(path1) !== 0) {
        // Complete change from one view to the next but DitoList is reused,
        // so clear the filters and load data with clearing.
        this.setQuery({})
        this.loadData(true)
        this.closeNotifications()
      } else if (path1 === path2 && from.hash === to.hash) {
        // Paths and hashes remain the same, so only queries have changed.
        // Update filter and reload data without clearing.
        this.addQuery(to.query)
        this.initData()
      } else {
        // Similar routes, but not the same: We're going back, so reapply the
        // previous query again.
        this.addQuery(this.query)
      }
    }
  },

  computed: {
    shouldLoad() {
      // If the route-component (view, form) that this list belongs to also
      // loads data, depend on this first.
      const { routeComponent } = this
      return !this.isTransient && !this.loading && !this.value &&
        !(routeComponent.shouldLoad || routeComponent.loading)
    },

    listSchema() {
      // The listSchema of a list is the list's schema itself.
      return this.schema
    },

    resource() {
      return { type: 'collection' }
    },

    path() {
      return this.routeComponent.isView ? '' : `${this.schema.path}/`
    },

    query() {
      return this.getStore('query')
    },

    total() {
      return this.getStore('total')
    },

    scopes() {
      return this.getNamedSchemas(this.schema.scopes)
    },

    columns() {
      return this.getNamedSchemas(this.schema.columns)
    }
  },

  methods: {
    defaultValue() {
      return []
    },

    getNamedSchemas(descs) {
      return isArray(descs)
        ? descs.map(value => (
          isObject(value) ? value : {
            name: camelize(value, false),
            label: labelize(value)
          }
        ))
        : isObject(descs)
          ? Object.entries(descs).map(
            ([name, value]) => isObject(value)
              ? {
                name,
                label: labelize(name, value),
                ...value
              }
              : {
                name,
                label: value
              }
          )
          : null
    },

    renderColumn(column, item) {
      const { name, render } = column
      const value = item[name]
      return render ? render(value, item) : escapeHtml(value)
    },

    setQuery(query) {
      // Always keep the displayed query parameters in sync with the store.
      // Use scope and page from the list schema as defaults, but allow the
      // route query parameters to override them.
      let { scope, scopes, page } = this.schema
      if (!scope && scopes) {
        // See if the parent-store has a scope setting, and reuse if possible
        const { $parent } = this.store.$parent
        const query = $parent && $parent.query
        scope = query && query.scope
        // Only use the parent value if it's a possible setting
        if (scope && !scopes.includes(scope)) {
          scope = null
        }
      }
      query = {
        ...(scope != null && { scope }),
        ...(page != null && { page }),
        ...query
      }
      this.$router.replace({ query })
      this.setStore('query', query)
    },

    addQuery(query) {
      this.setQuery({ ...this.query, ...query })
    },

    setData(data) {
      // When new data is loaded, we can store it right back in the data of the
      // view or form that created this list component.
      this.value = data
    },

    removeItem(item) {
      const list = this.value
      const index = list && list.indexOf(item)
      if (index >= 0) {
        list.splice(index, 1)
      }
    },

    deleteItem(item, index) {
      const title = item && this.getItemTitle(item, index)

      const notify = () => this.notify('success', 'Successfully Removed',
        `${title} was ${this.verbDeleted}.`)

      if (item && confirm(
        `Do you really want to ${this.verbDelete} ${title}?`)
      ) {
        if (this.isTransient) {
          this.removeItem(item)
          notify()
        } else {
          const resource = {
            type: 'member',
            id: this.getItemId(item)
          }
          this.request('delete', { resource }, err => {
            if (!err) {
              this.removeItem(item)
              notify()
            }
            this.reloadData()
          })
        }
      }
    },

    createItem(schema, type) {
      const item = this.createData(schema, { type })
      this.value.push(item)
      return item
    },

    navigateToComponent(path, onComplete) {
      const route = path.split('/')
      // Put collection/id pairs (even numbers) into route, and what's left
      // identifies the property to focus.
      const property = route.length & 1 ? route.pop() : null
      const location = route.join('/')
      const { matched } = this.$router.match(location)
      if (matched.length) {
        this.$router.push({ path: location, append: true }, route => {
          if (onComplete) {
            onComplete(route, property)
          }
        })
      } else {
        throw new Error(`Cannot find route field ${path}.`)
      }
    }
  }
}
