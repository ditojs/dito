import DataMixin from '@/mixins/DataMixin'
import {escapeHtml, stripTags} from '@/utils/html'
import isObject from 'isobject'

export default {
  mixins: [DataMixin],

  data() {
    return {
      isList: true,
      filterScope: null,
      sortKey: null,
      sortOrder: 1
    }
  },

  computed: {
    listLabels() {
      const components = this.formDesc.components
      let labels = []
      for (let key in components) {
        labels.push(components[key].label)
      }
      return labels
    },

    shouldLoad() {
      return !this.isTransient && !this.value
    },

    viewDesc() {
      // The view description of a list is the list's description itself.
      return this.desc
    },

    endpoint() {
      return this.getEndpoint('get', 'collection')
    },

    path() {
      return this.routeComponent.isView ? '' : `${this.desc.path}/`
    },

    scopes() {
      return this.getNamedDescriptions(this.desc.scopes)
    },

    columns() {
      return this.getNamedDescriptions(this.desc.columns)
    },

    renderCells() {
      // Returns a function to render the cells with, supporting different
      // formats of desc:
      const render = this.desc.render
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
    initValue() {
      return []
    },

    getTitle(item) {
      return stripTags(this.renderCells(item)[0])
    },

    getNamedDescriptions(descs) {
      return Array.isArray(descs)
        ? descs.map(value => (
          isObject(value) ? value : { label: value }
        ))
        : isObject(descs)
          ? Object.entries(descs).map(([name, value]) => (
            isObject(value) ? { ...value, name } : { label: value, name }
          ))
          : null
    },

    filterByScope(name) {
      this.filterScope = name
      this.loadData(false, { scope: name })
    },

    sortByColumn(name) {
      if (this.sortKey !== name) {
        this.sortKey = name
        this.sortOrder = 1
      } else {
        this.sortOrder *= -1
      }
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
