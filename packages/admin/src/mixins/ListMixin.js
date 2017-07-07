import DataMixin from '@/mixins/DataMixin'
import {escapeHtml, stripTags} from '@/utils'
import isObject from 'isobject'

export default {
  mixins: [DataMixin],

  data() {
    return {
      isList: true
    }
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
        this.filter = {}
        this.loadData(true)
      } else if (path1 === path2 && from.hash === to.hash) {
        // Paths and hashes remain the same, so only queries have changed.
        // Update filter and reload data without clearing.
        this.setFilter(to.query)
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
      return this.getEndpoint('get', 'collection')
    },

    path() {
      return this.routeComponent.isView ? '' : `${this.schema.path}/`
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
    initData() {
      // Make sure filters are set correctly before initData() triggers request.
      this.setFilter(this.$route.query)
      // super.initData()
      DataMixin.methods.initData.call(this)
    },

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

    getFilter(filter) {
      return Object.assign({}, this.filter, filter)
    },

    setFilter(filter) {
      this.filter = Object.assign({}, this.filter, filter)
    },

    getSortParams() {
      return (this.filter.order || '').split(' ')
    },

    getSortOrder(name) {
      let [sortName, sortOrder] = this.getSortParams()
      const order = sortName === name && sortOrder === 'asc' ? 'desc' : 'asc'
      return `${name} ${order}`
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
          this.request('delete', this.getEndpoint('delete', 'member', item.id),
            null, null,
            error => {
              if (!error) {
                this.removeItem(item)
              }
              this.reloadData()
            }
          )
        }
      }
    }
  }
}
