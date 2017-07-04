import DataMixin from '@/mixins/DataMixin'

export default {
  mixins: [DataMixin],

  data() {
    return {
      isList: true
    }
  },

  computed: {
    listData() {
      return this.data[this.name]
    },

    listLabels() {
      const components = this.formDesc.components
      let labels = []
      for (let key in components) {
        labels.push(components[key].label)
      }
      return labels
    },

    shouldLoad() {
      return !this.desc.embedded && !this.listData
    },

    viewDesc() {
      // The view description of a list is the list's description itself.
      return this.desc
    },

    endpoint() {
      return this.getEndpoint('get', 'collection')
    },

    path() {
      return this.routeComponent.isView ? '' : `${this.api.normalize(this.name)}/`
    }
  },

  methods: {
    setData(data) {
      // When new data is loaded, we can store it right back in the data of the
      // view or form that created this list component.
      this.$set(this.data, this.name, data)
    },

    removeItem(item) {
      const data = this.listData
      const index = data && data.indexOf(item)
      if (index >= 0) {
        data.splice(index, 1)
      }
    },

    remove(item) {
      if (item &&
          confirm(`Do you really want to remove "${this.getTitle(item)}"?`)) {
        if (this.isTransient(item)) {
          this.removeItem(item)
        } else {
          this.request('delete', this.getEndpoint('delete', 'member', item.id),
            null, null,
            err => {
              if (!err) {
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
