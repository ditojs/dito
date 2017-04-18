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

    view() {
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
      this.$set(this.data, this.name, data)
    },

    remove(item) {
      if (item &&
          confirm(`Do you really want to remove "${this.getTitle(item)}"?`)) {
        this.send('delete', this.getEndpoint('delete', 'member', item.id), null,
          err => {
            if (!err) {
              const data = this.listData
              const index = data && data.indexOf(item)
              if (index >= 0) {
                data.splice(index, 1)
              }
            }
            this.reloadData()
          }
        )
      }
    }
  }
}
