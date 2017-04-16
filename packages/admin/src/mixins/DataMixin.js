import stripTags from '@/utils/stripTags'

// Assumes: Component has this.api

export default {
  data() {
    return {
      // We need to start with an empty object for DitoForm, not with null
      data: {},
      error: null,
      loading: false
    }
  },

  created() {
    // Setup data after view was created and the data is already being observed.
    this.initData()
  },

  methods: {
    getEndpoint(method, type, id) {
      return this.api.endpoints[method][type](this.view, this.form, id)
    },

    send(method, path, data, callback) {
      // TODO: Shall we fall back to axios locally imported, if no send method
      // is defined?
      this.error = null
      const send = this.api.send
      if (send) {
        this.loading = true
        send(method, path, data, (err, result) => {
          this.loading = false
          if (!result) {
            err = 'Unable to load data.'
          }
          if (err) {
            this.error = err.toString()
          }
          if (callback) {
            callback.call(this, err, result)
          }
        })
        return true
      }
    },

    loadData(clear) {
      if (this.shouldLoad) {
        if (clear) {
          this.data = {}
        }
        this.send('get', this.endpoint, null, (err, data) => {
          if (!err) {
            this.setData(data || {})
            if (!data) {
              // this.$router.push('..')
            }
          }
        })
      }
    },

    setData(data) {
      this.data = data
    },

    initData() {
      this.loadData(true)
    },

    remove(item, text) {
      if (item &&
          confirm(`Do you really want to remove "${stripTags(text)}"?`)) {
        this.send('delete', this.getEndpoint('delete', 'member', item.id), null,
          err => {
            if (!err) {
              const data = this.data[this.name]
              const index = data && data.indexOf(item)
              if (index >= 0) {
                data.splice(index, 1)
              }
            }
            this.loadData(false)
          }
        )
      }
    }
  }
}
