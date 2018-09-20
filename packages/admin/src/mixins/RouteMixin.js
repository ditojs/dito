// @vue/component
export default {
  $_veeValidate: {
    // Each route-component shall provide a vee-validate $validator object,
    // to be shared along all its children.
    // See: https://github.com/logaretm/vee-validate/issues/468
    validator: 'new'
  },

  provide() {
    return {
      $routeComponent: this
    }
  },

  data() {
    return {
      reload: false,
      // Each route-component defines a store that gets passed on to its
      // child components, so they can store values in them that live beyond
      // their life-cycle. See: DitoComponents, SourceMixin
      store: {}
    }
  },

  computed: {
    routeComponent() {
      // Override DitoMixin's routeComponent() which uses the injected value.
      return this
    },

    routeRecord() {
      // Retrieve the route-record to which this component was mapped to:
      // https://github.com/vuejs/vue-router/issues/1338#issuecomment-296381459
      return this.$route.matched[this.$vnode.data.routerViewDepth]
    },

    isLastRoute() {
      // Returns true when this router component is the last one in the route.
      const { matched } = this.$route
      return this.routeRecord === matched[matched.length - 1]
    },

    isNestedRoute() {
      return !!this.routeRecord.meta.nested
    },

    isLastUnnestedRoute() {
      const { matched } = this.$route
      for (let i = matched.length - 1; i >= 0; i--) {
        const match = matched[i]
        if (!match.meta.nested) {
          return this.routeRecord === match
        }
      }
      return false
    },

    meta() {
      return this.routeRecord.meta
    },

    path() {
      return this.getRoutePath(this.routeRecord.path)
    },

    label() {
      return this.getLabel(this.schema)
    },

    breadcrumb() {
      const { breadcrumb } = this.schema || {}
      return breadcrumb || `${this.breadcrumbPrefix} ${this.label}`
    },

    breadcrumbPrefix() {
      return ''
    },

    param() {
      // Workaround for vue-router not being able to map multiple url parameters
      // with the same name to multiple components, see:
      // https://github.com/vuejs/vue-router/issues/1345
      return this.$route.params[this.meta.param]
    },

    nestedRouteComponents() {
      const { routeComponents } = this.appState
      return routeComponents.slice(routeComponents.indexOf(this) + 1)
    },

    nestedFormComponents() {
      return this.nestedRouteComponents.filter(component => component.isForm)
    }
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

  methods: {
    getRoutePath(templatePath) {
      // Maps the route's actual path to the matched routes by counting its
      // parts separated by '/', splitting the path into the mapped parts
      // containing actual parameters.
      return this.$route.path
        .split('/')
        .slice(0, templatePath.split('/').length)
        .join('/')
    }
  }
}
