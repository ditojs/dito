import appState from '@/appState'
import DitoComponent from '@/DitoComponent'
import { labelize } from '@ditojs/utils'

export default {
  data() {
    return {
      appState
    }
  },

  computed: {
    api() {
      return this.meta?.api || null
    },

    rootComponent() {
      return this.$root.$children[0]
    },

    routeComponent() {
      // Loop through all non-route components (e.g. DitoComponents, DitoTab)
      // until the closest component that is in the route is found.
      let comp = this
      while (comp && !comp.isRoute) {
        comp = comp.$parent
      }
      // Only return the component if its still in the route
      return comp?.routeRecord ? comp : null
    },

    formComponent() {
      const comp = this.routeComponent
      return comp?.isForm ? comp : null
    },

    parentRouteComponent() {
      return (this.isRoute ? this.$parent : this)?.routeComponent
    },

    parentFormComponent() {
      return (this.isForm ? this.$parent : this)?.formComponent
    },

    // Returns the first route component in the chain of parents that doesn't
    // hold nested data.
    dataRouteComponent() {
      let { routeComponent } = this
      while (routeComponent?.isNested) {
        routeComponent = routeComponent.parentRouteComponent
      }
      return routeComponent
    }
  },

  methods: {
    // The state of components is only available during the life-cycle of a
    // component. Some information we need available longer than that, e.g.
    // `query` & `total` on TypeList, so that when the user navigates back from
    // editing an item in the list, the state of the list is still the same.
    // We can't store this in `data`, as this is already the pure data from the
    // API server. That's what the `store` is for: Memory that's available as
    // long as the current editing path is still valid. For type components,
    // this memory is provided by the parent, see RouteMixin and DitoComponents.
    getStore(key) {
      return this.store[key]
    },

    setStore(key, value) {
      return this.$set(this.store, key, value)
    },

    getChildStore(key) {
      return this.getStore(key) || this.setStore(key, {})
    },

    getLabel(schema, name) {
      return schema ? schema.label || labelize(schema.name || name) : ''
    },

    labelize,

    appendDataPath(dataPath = '', token) {
      return dataPath !== ''
        ? `${dataPath}/${token}`
        : token
    },

    showDialog(options, config) {
      this.$modal.show(DitoComponent.component('dito-dialog'), options, config)
    },

    notify(...args) {
      const type = args.length > 1 ? args[0] : 'info'
      const title = args.length > 2 ? args[1] : {
        warning: 'Warning',
        error: 'Error',
        info: 'Information',
        success: 'Success'
      }[type]
      const content = args[args.length - 1]
      let text = type === 'error' && content.message || content.toString()
      const duration = 1500 + (text.length + title.length) * 20
      text = text.replace(/\r\n|\n|\r/g, '<br>')
      this.$notify({ type, title, text, duration })
      const log = {
        warning: 'warn',
        error: 'error',
        info: 'log',
        success: 'log'
      }[type]
      console[log](content)
    },

    closeNotifications() {
      this.rootComponent.$refs.notifications.destroyAll()
    }
  }
}
