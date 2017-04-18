import DataMixin from '@/mixins/DataMixin'

export default {
  mixins: [DataMixin],

  data() {
    return {
      isRoute: true
    }
  },

  computed: {
    routeRecord() {
      // Walks through the matched routes and all components of each route, to
      // find the route that is associated with this component, and returns it.
      // NOTE: This needs to be a computed property so that a change in $route
      // will trigger a recalculated meta on reused router components.
      for (let route of this.$route.matched) {
        const instances = route.instances
        let empty = true
        for (let name in instances) {
          if (instances[name] === this) {
            return route
          }
          empty = false
        }
        // If this route contains no instance, then we're hitting this issue:
        // https://github.com/vuejs/vue-router/issues/1338
        // Lucky for Dito, we can assume in those situations that this component
        // is the default instance of the route, and patch the record:
        if (empty) {
          instances.default = this
          return route
        }
      }
      return null
    },

    param() {
      // Workaround for vue-router not being able to map multiple url parameters
      // with the same name to multiple components, see:
      // https://github.com/vuejs/vue-router/issues/1345
      return this.$route.params[this.meta.param]
    },

    isLastRoute() {
      // Returns true when this router component is the last one in the route.
      const matched = this.$route.matched
      return this.routeRecord === matched[matched.length - 1]
    },

    meta() {
      const record = this.routeRecord
      // Return an empty meta object if no route record was found, to prevent
      // full-on crashes elsewhere.
      return record ? record.meta : {}
    }
  }
}
