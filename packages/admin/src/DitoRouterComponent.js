import DitoComponent from './DitoComponent'

export default DitoComponent.extend({
  data() {
    return {
      loading: false,
      data: null,
      error: null
    }
  },

  created() {
    // Fetch data after view was created and the data is already being observed.
    this.getData()
  },

  watch: {
    // Call fetch() again when the route changes, to support component reuse.
    '$route': 'getData'
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
    },

    path() {
      return this.$meta.path
    }
  },

  methods: {
    send(method, path, data, callback) {
      // TODO: Shall we fall back to axios locally imported, if no send method
      // is defined?
      let send = this.$meta.api.send
      this.error = null
      if (method === 'get') {
        this.data = null
      }
      this.loading = !!send
      return send && send(method, path, data, (err, result) => {
        this.loading = false
        if (err) {
          this.error = err.toString()
        } else {
          this.data = result
          if (callback) {
            callback()
          }
        }
      })
    },

    getData() {
      if (this.load) {
        this.send('get', this.path)
      }
    }
  }
})
