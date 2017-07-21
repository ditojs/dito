import appState from '@/appState'
import {label} from '@/utils'

export default {
  data() {
    return {
      appState
    }
  },

  computed: {
    // Short-cuts to meta properties:
    viewSchema() { return this.meta.viewSchema },
    formSchema() { return this.viewSchema.formSchema },
    user() { return this.meta.user },
    api() { return this.meta.api },

    routeComponent() {
      // Loop through all non-route components (e.g. DitoPanel, DitoTab) until
      // the closest component that is in the route is found.
      let comp = this
      while (comp && !comp.isRoute) {
        comp = comp.$parent
      }
      return comp
    },

    parentRouteComponent() {
      return this.$parent.routeComponent
    },

    formComponent() {
      let comp = this.routeComponent
      return comp && comp.isForm ? comp : null
    },

    parentFormComponent() {
      return this.$parent.formComponent
    }
  },

  methods: {
    // The state of components is only available during the life-cycle of a
    // component. Some information we need available longer than that, e.g.
    // `filter` & `count` on DitoList, so that when the user navigates back from
    // editing an item in the list, the state of the list is still the same.
    // We can't store this in `data`, as this is already the pure data from the
    // API server. That's what the `store` is for: Memory that's available as
    // long as the current editing path is still valid. For type components,
    // this memory is provided by the parent, see RouteMixin and DitoPanel.
    getStore(key) {
      return this.store[key] || this.setStore(key, {})
    },

    setStore(key, value) {
      return this.$set(this.store, key, value)
    },

    renderLabel(schema, name) {
      return schema.label || label(schema.name || name)
    },

    getElement(selector) {
      const proto = Element.prototype
      const matches = proto.matches ||
        proto.matchesSelector ||
        proto.webkitMatchesSelector ||
        proto.mozMatchesSelector ||
        proto.msMatchesSelector ||
        proto.oMatchesSelector
      const el = this.$el
      return matches.call(el, selector) ? el : el.querySelector(selector)
    }
  }
}
