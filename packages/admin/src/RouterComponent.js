import BaseComponent from './BaseComponent'
import stripTags from '@/utils/stripTags'

export default BaseComponent.extend({
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
    this.setupData()
  },

  watch: {
    // Call setupData() again when the route changes to support component reuse.
    $route() {
      this.setupData()
    }
  },

  computed: {
    routeRecord() {
      // Walks through the matched routes and all components of each route, to
      // find the route that is associated with this component, and returns it.
      // NOTE: This needs to be a computed property so that a change in $route
      // will trigger a recalculated meta on reused router components.
      for (let route of this.$route.matched) {
        const components = route.components
        for (let name in components) {
          if (components[name] === this.constructor) {
            return route
          }
        }
      }
      return null
    },

    isLastRoute() {
      // Returns true when this router component is the last one in the route.
      const record = this.routeRecord
      const matched = this.$route.matched
      return record === matched[matched.length - 1]
    },

    meta() {
      const record = this.routeRecord
      return record ? record.meta : null
    },

    // Short-cuts to meta properties:
    name() { return this.meta.name },
    view() { return this.meta.view },
    form() { return this.meta.form },
    user() { return this.meta.user },
    api() { return this.meta.api }
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
      // Only load data if this component is the last one in the route
      if (this.isLastRoute) {
        if (clear) {
          this.data = {}
        }
        this.send('get', this.endpoint, null, (err, data) => {
          if (!err) {
            this.setData(data)
          }
        })
      }
    },

    setData(data) {
      this.data = data
    },

    setupData() {
      this.loadData(true)
    },

    remove(item, text) {
      if (item && confirm(`Do you really want to remove "${stripTags(text)}"?`)) {
        this.send('delete', this.getEndpoint('delete', 'member', item.id), null,
          (err) => {
            if (!err) {
              const index = this.data.indexOf(item)
              if (index >= 0) {
                this.data.splice(index, 1)
              }
            }
            this.loadData(false)
          }
        )
      }
    }
  }
})
