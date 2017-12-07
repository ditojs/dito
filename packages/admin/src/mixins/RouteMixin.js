export default {
  // Each route-component shall provide a vee-validate $validator object,
  // to be shared along all its children.
  // See: https://github.com/logaretm/vee-validate/issues/468
  $_veeValidate: {
    validator: 'new'
  },

  created() {
    // Keep a shared stack of root components for DitoTrail to use to render
    // labels. Can't rely on $route.matched[i].instances.default unfortunately,
    // as instances aren't immediately ready, and instances is not reactive.
    this.appState.routeComponents.push(this)
  },

  destroyed() {
    const { routeComponents } = this.appState
    routeComponents.splice(routeComponents.indexOf(this), 1)
  },

  data() {
    return {
      isRoute: true,
      reload: false,
      storeData: {}
    }
  },

  computed: {
    routeRecord() {
      // Retrieve the route-record to which this component was mapped to:
      // https://github.com/vuejs/vue-router/issues/1338#issuecomment-296381459
      return this.$route.matched[this.$vnode.data.routerViewDepth]
    },

    meta() {
      return this.routeRecord.meta
    },

    schema() {
      return this.meta.schema
    },

    label() {
      return this.getLabel(this.schema)
    },

    store() {
      // Each route-component defines a store that gets passed on to its
      // child components, so they can store values in them that live beyond
      // their life-cycle. See: DitoPanel, ListMixin
      // These stores are also made aware of their parents, so settings can
      // propagate.
      const { parentStore } = this
      if (parentStore) {
        this.$set(this.storeData, '$parent', parentStore)
      }
      return this.storeData
    },

    parentStore() {
      // This getter is part of linking up store intances with their parents.
      // By default, it's just the store of the parent route-component.
      // See DitoForm for its override of parentStore()
      const { parentRouteComponent } = this
      return parentRouteComponent && parentRouteComponent.store
    },

    breadcrumb() {
      const { breadcrumb } = this.schema || {}
      return breadcrumb || `${this.breadcrumbPrefix} ${this.label}`
    },

    breadcrumbPrefix() {
      return ''
    },

    isLastRoute() {
      // Returns true when this router component is the last one in the route.
      const { matched } = this.$route
      return this.routeRecord === matched[matched.length - 1]
    },

    param() {
      // Workaround for vue-router not being able to map multiple url parameters
      // with the same name to multiple components, see:
      // https://github.com/vuejs/vue-router/issues/1345
      return this.$route.params[this.meta.param]
    }
  }
}
