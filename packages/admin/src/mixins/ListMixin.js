import DataMixin from '@/mixins/DataMixin'

export default {
  mixins: [DataMixin],

  computed: {
    listData() {
      return this.data[this.name]
    },

    shouldLoad() {
      return this.desc.load && !this.listData
    },

    viewDesc() {
      // The view description of a list is the list's description itself.
      return this.desc
    },

    endpoint() {
      return this.getEndpoint('get', 'collection')
    },

    route() {
      return this.routeComponent.isView ? '' : `${this.name}/`
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
          this.send('delete', this.getEndpoint('delete', 'member', item.id),
            null,
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
