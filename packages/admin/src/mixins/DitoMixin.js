import appState from '@/appState'
import TypeMixin from './TypeMixin'
import { isFunction, asObject, labelize } from '@ditojs/utils'

export default {
  data() {
    return {
      appState
    }
  },

  computed: {
    // Short-cuts to meta properties:
    user() { return this.meta.user },
    api() { return this.meta.api },

    rootComponent() {
      return this.$root.$children[0]
    },

    routeComponent() {
      // Loop through all non-route components (e.g. DitoPanel, DitoTab) until
      // the closest component that is in the route is found.
      let comp = this
      while (comp && !comp.isRoute) {
        comp = comp.$parent
      }
      // Only return the component if its still in the route
      return comp.routeRecord ? comp : null
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

    // Returns the first formComponent in the chain of parents that doesn't hold
    // nested data.
    dataFormComponent() {
      let { formComponent } = this
      while (formComponent?.isNested) {
        formComponent = formComponent.parentFormComponent
      }
      return formComponent
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
    // this memory is provided by the parent, see RouteMixin and DitoPanel.
    getStore(key) {
      return this.store[key]
    },

    setStore(key, value) {
      return this.$set(this.store, key, value)
    },

    getChildStore(key) {
      return this.getStore(key) || this.setStore(key, {})
    },

    getLabel(schema) {
      return schema ? schema.label || labelize(schema.name) : ''
    },

    setHiddenProperty(object, key, value = true) {
      return object != null
        ? Object.defineProperty(asObject(object), key, {
          enumerable: false,
          configurable: true,
          writeable: true,
          value
        })
        : object
    },

    setFlag(object, flag) {
      return this.setHiddenProperty(object, flag, true)
    },

    setParent(object, parent) {
      return this.setHiddenProperty(object, '$parent', parent)
    },

    resolveTypeComponent(component) {
      // A helper method to allow two things:
      // - When used in a computed property, it removes the need to have to
      //   load components with async functions `component: () => import(...)`.
      //   instead, they can be directly provided: `component: import(...)`
      // - The properties passed to such components don't need to be defined.
      //   Instead, the default TypeMixin props are automatically set.
      return component
        ? async () => {
          // At first, resolve component is it is loaded asynchronously.
          let comp = isFunction(component)
            ? await component()
            : await component
          comp = comp?.default || comp
          if (comp.options) {
            comp.options.props = TypeMixin.props
          } else {
            comp.props = TypeMixin.props
          }
          return comp
        }
        : component
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
