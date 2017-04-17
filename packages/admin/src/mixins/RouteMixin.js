export default {
  computed: {
    routeRecord() {
      // Walks through the matched routes and all components of each route, to
      // find the route that is associated with this component, and returns it.
      // NOTE: This needs to be a computed property so that a change in $route
      // will trigger a recalculated meta on reused router components.
      for (let route of this.$route.matched) {
        const instances = route.instances
        for (let name in instances) {
          if (instances[name] === this) {
            return route
          }
        }
      }
      return null
    },

    id() {
      return this.$route.params[this.meta.param]
    },

    isLastRoute() {
      // Returns true when this router component is the last one in the route.
      const matched = this.$route.matched
      return this.routeRecord === matched[matched.length - 1]
    },

    meta() {
      const record = this.routeRecord
      return record ? record.meta : null
    }
  }
}
