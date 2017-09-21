import DataMixin from '@/mixins/DataMixin'
import {isObject, escapeHtml, camelize, labelize} from '@/utils'

export default {
  mixins: [DataMixin],

  data() {
    return {
      isList: true
    }
  },

  created() {
    // Make sure filters are set correctly before initData() triggers request.
    this.addFilter(this.$route.query)
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
        this.setFilter({})
        this.loadData(true)
      } else if (path1 === path2 && from.hash === to.hash) {
        // Paths and hashes remain the same, so only queries have changed.
        // Update filter and reload data without clearing.
        this.addFilter(to.query)
        this.loadData(false)
      }
    }
  },

  computed: {
    shouldLoad() {
      return !this.isTransient && !this.value
    },

    viewSchema() {
      // The view description of a list is the list's description itself.
      return this.schema
    },

    endpoint() {
      return { type: 'collection' }
    },

    path() {
      return this.routeComponent.isView ? '' : `${this.schema.path}/`
    },

    filter() {
      return this.store.filter
    },

    count() {
      return this.store.count
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
      return Array.isArray(descs)
        ? descs.map(value => (
          isObject(value) ? value : {
            name: camelize(value, false),
            label: labelize(value)
          }
        ))
        : isObject(descs)
          ? Object.entries(descs).map(([name, value]) => (
            isObject(value) ? { name, ...value } : { name, label: value }
          ))
          : null
    },

    renderColumn(column, item) {
      const {name, render} = column
      const value = item[name]
      return render ? render(value, item) : escapeHtml(value)
    },

    setFilter(filter) {
      this.setStore('filter', filter)
    },

    addFilter(filter) {
      this.setFilter({...this.filter, ...filter})
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

    deleteItem(item) {
      if (item && confirm(
        `Do you really want to ${this.verbDelete} "${this.getItemTitle(item)}"?`
      )) {
        if (this.isTransient) {
          this.removeItem(item)
        } else {
          const endpoint = { type: 'member', id: item.id }
          this.request('delete', { endpoint }, err => {
            if (!err) {
              this.removeItem(item)
            }
            this.reloadData()
          })
        }
      }
    },

    navigateToComponent(path, onComplete) {
      const route = [...path]
      const rest = path.length & 1 ? route.pop() : null
      this.$router.push({ path: route.join('/'), append: true }, route => {
        if (onComplete) {
          if (rest) {
            // Tell DitoForm to focus component
            route.matched[route.matched.length - 1].meta.focus = rest
          }
          onComplete(route)
        }
      })
    }
  }
}
