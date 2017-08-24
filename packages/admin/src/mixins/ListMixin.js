import DataMixin from '@/mixins/DataMixin'
import {isObject, escapeHtml, stripTags} from '@/utils'

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
    listLabels() {
      const components = this.formSchema.components
      let labels = []
      for (let key in components) {
        labels.push(components[key].label)
      }
      return labels
    },

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
    },

    renderCells() {
      // Returns a function to render the cells with, supporting different
      // schema formats:
      const render = this.schema.render
      const columns = this.columns
      const firstColumn = columns && columns[0]
      return !render && firstColumn && firstColumn.name
        // If we have named columns, map their names to item attributes, with
        // optional per-column render() functions:
        ? item => {
          return columns.map(column => {
            const value = item[column.name]
            return column.render
              ? column.render.call(item, value)
              : value
          })
        }
        : item => {
          const res = render && render(item) ||
            item.html || escapeHtml(item.text)
          const cells = Array.isArray(res) ? res : [res]
          // Make sure we have the right amount of cells for the table
          if (columns) {
            cells.length = columns.length
          }
          return cells
        }
    }
  },

  methods: {
    defaultValue() {
      return []
    },

    getTitle(item) {
      return stripTags(this.renderCells(item)[0])
    },

    getNamedSchemas(descs) {
      return Array.isArray(descs)
        ? descs.map(value => {
          const name = value.toLowerCase()
          return isObject(value) ? { ...value, name } : { label: value, name }
        })
        : isObject(descs)
          ? Object.entries(descs).map(([name, value]) => (
            isObject(value) ? { ...value, name } : { label: value, name }
          ))
          : null
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
      if (item &&
          confirm(`Do you really want to remove "${this.getTitle(item)}"?`)) {
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
