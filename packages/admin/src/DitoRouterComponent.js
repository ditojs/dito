import DitoComponent from './DitoComponent'

export default DitoComponent.extend({
  data() {
    return {
      data: this.$options.emptyData(),
      error: null,
      loading: false
    }
  },

  created() {
    // Load data after view was created and the data is already being observed.
    this.loadData(true)
  },

  watch: {
    // Call loadData() again when the route changes, to support component reuse.
    $route() {
      this.loadData(true)
    }
  },

  computed: {
    $meta() {
      // Walks through the matched routes and all components of each route, to
      // find the route that is associated with this component, and returns it.
      // NOTE: This needs to be a computed property so that a change in $route
      // will trigger a recalculated $meta on reused router components.
      for (let route of this.$route.matched) {
        let components = route.components
        for (let name in components) {
          if (components[name] === this.constructor) {
            return route.meta
          }
        }
      }
      return null
    },

    load() {
      // This is in computed so it can be overridden in DitoForm
      return true
    }
  },

  methods: {
    send(method, path, data, callback) {
      // TODO: Shall we fall back to axios locally imported, if no send method
      // is defined?
      this.error = null
      let send = this.$meta.api.send
      if (send) {
        this.loading = true
        send(method, path, data, (err, result) => {
          this.loading = false
          if (err) {
            this.error = err.toString()
          }
          if (callback) {
            callback.call(this, result)
          }
        })
        return true
      }
    },

    loadData(clear) {
      if (this.load) {
        if (clear) {
          this.data = this.$options.emptyData()
        }
        this.send('get', this.path, null, (data) => {
          this.data = data
        })
      }
    },

    getViewPath() {
      let getViewPath = this.$meta.api.getViewPath
      let view = this.$meta.view
      return !view ? null : getViewPath
          ? getViewPath(view)
          : view.endpoint
    },

    getFormPath(id) {
      let getFormPath = this.$meta.api.getFormPath
      let form = this.$meta.form
      return !form ? null : getFormPath
          ? getFormPath(form, id)
          : `${form.endpoint}/${id}`
    },

    remove(item) {
      if (item && confirm(`Do you really want to remove "${item.text}"?`)) {
        this.send('delete', this.getFormPath(item.id), null, () => {
          let index = this.data.indexOf(item)
          if (index >= 0) {
            this.data.splice(index, 1)
          }
          this.loadData(false)
        })
      }
    }
  }
})
