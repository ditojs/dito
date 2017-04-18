// Assumes: Component defines this.api

export default {
  data() {
    return {
      error: null,
      loading: false,
      loadedData: null
    }
  },

  created() {
    // Initialize data after component was created and the data is already being
    // observed.
    if (this.isLastRoute) {
      this.initData()
    }
  },

  computed: {
    shouldLoad() {
      return !this.loadedData
    }
  },

  watch: {
    $route() {
      if (this.isLastRoute) {
        // See goBack() for the value of this.meta.mode
        const mode = this.meta.mode
        this.meta.mode = null
        // Only initialize if we're not going back in the route through cancel
        // or submit, and reload if the child form was submitting new data.
        // Execute in next tick so implementing components can also watch $route
        // and handle changes that affect reloadData(), e.g. in DitoView.
        this.$nextTick(function() {
          if (mode === 'submit') {
            this.reloadData()
          } else if (this.shouldLoad) {
            this.initData()
          }
        })
      }
    }
  },

  methods: {
    goBack(mode) {
      // Tell watch $route() of the parent route component what the user did.
      this.parentRouteComponent.meta.mode = mode
      this.$router.push({ path: '..', append: true })
    },

    getEndpoint(method, type, id) {
      return this.api.endpoints[method][type](this.view, this.form,
          type === 'collection' ? this.parentFormComponent : id)
    },

    setData(data) {
      this.loadedData = data
    },

    initData() {
      if (this.shouldLoad) {
        this.loadData(true)
      }
    },

    reloadData() {
      this.loadData(false)
    },

    loadData(clear) {
      if (clear) {
        this.loadedData = null
      }
      this.send('get', this.endpoint, null, (err, data) => {
        if (!err) {
          this.setData(data)
        }
      })
    },

    setLoading(loading) {
      // Only display loading progress on route components
      this.routeComponent.loading = loading
    },

    send(method, path, payload, callback) {
      // TODO: Shall we fall back to axios locally imported, if no send method
      // is defined?
      this.error = null
      const send = this.api.send
      if (send) {
        this.setLoading(true)
        send(method, path, payload, (err, result) => {
          this.setLoading(false)
          if (err) {
            this.error = err.toString()
          }
          if (callback) {
            callback.call(this, err, result)
          }
        })
        return true
      }
    }
  }
}
