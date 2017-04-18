export default {
  computed: {
    // Short-cuts to meta properties:
    view() { return this.meta.view },
    form() { return this.view.form },
    user() { return this.meta.user },
    api() { return this.meta.api },

    routeComponent() {
      return this.getRouteComponent(this)
    },

    parentRouteComponent() {
      return this.getRouteComponent(this.$parent)
    },

    formComponent() {
      let comp = this.routeComponent
      return comp && comp.isForm ? comp : null
    },

    parentFormComponent() {
      let comp = this.parentRouteComponent
      return comp && comp.isForm ? comp : null
    }
  },

  methods: {
    getRouteComponent(comp) {
      // Loop through all non-route components (e.g. DitoPanel, DitoTab) until
      // the closest component that is in the route is found.
      while (comp && !comp.isRoute) {
        comp = comp.$parent
      }
      return comp
    }
  }
}
