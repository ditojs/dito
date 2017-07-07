import appState from '@/appState'

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
    renderLabel(schema) {
      // Handle hyphenated, underscored and camel-cased property names and
      // expand them to title cased labels if no label was provided:
      // console.log(this.renderLabel({ name: 'some-hyphenated-label' }))
      // console.log(this.renderLabel({ name: 'one_underscored_label' }))
      // console.log(this.renderLabel({ name: 'MyCamelcasedLabel' }))
      return schema.label || schema.name.replace(
        /([-_]|^)(\w)|([a-z])([A-Z])/g,
        function(all, hyphen, hyphenated, camelLeft, camelRight) {
          return hyphenated
            ? `${hyphen ? ' ' : ''}${hyphenated.toUpperCase()}`
            : `${camelLeft} ${camelRight}`
        }
      )
    }
  }
}
