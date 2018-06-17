import appState from '@/appState'
import DitoComponent from '@/DitoComponent'
import {
  isObject, isArray, isString, isFunction, asArray, camelize, labelize
} from '@ditojs/utils'

export default {
  inject: ['api', 'parentSchema'],

  data() {
    return {
      appState,
      overrides: null
    }
  },

  computed: {
    user() {
      return appState.user
    },

    rootComponent() {
      return this.$root.$children[0]
    },

    routeComponent() {
      // Only return this if it's still in the route (has a `routeRecord`).
      if (this.isRoute && this.routeRecord) {
        return this
      }
      // Skip to the parent that defines the `routeComponent` computed property,
      // and defer to it. This filtering is required due to the use of non-Dito
      // components such as VueDraggable, which don't inherit the DitoMixin.
      let parent = this.$parent
      while (parent && !('routeComponent' in parent)) {
        parent = parent.$parent
      }
      return parent?.routeComponent
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
    },

    // Returns the data of the first route component in the chain of parents
    // that doesn't hold nested data.
    rootData() {
      return this.dataRouteComponent?.data
    },

    parentData() {
      return this.parentRouteComponent?.data
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

    getSchemaValue(key, matchRole = false, schema = this.schema) {
      let value = schema?.[key]
      if (isFunction(value)) {
        // Only call the callback if we actually have data already
        value = this.data ? value.call(this, this.data) : null
      }
      if (matchRole && (isString(value) || isArray(value))) {
        value = this.user.hasRole(...asArray(value))
      }
      return value
    },

    getLabel(schema, name) {
      return schema
        ? this.getSchemaValue('label', false, schema) ||
          labelize(schema.name || name)
        : ''
    },

    labelize,

    getNamedSchemas(descriptions) {
      const toObject = (array, toSchema) => array.reduce((object, value) => {
        const schema = toSchema(value)
        object[schema.name] = schema
        return object
      }, {})

      return isArray(descriptions)
        ? toObject(descriptions, value => (
          isObject(value) ? value : {
            name: camelize(value, false)
          }
        ))
        : isObject(descriptions)
          ? toObject(Object.entries(descriptions),
            ([name, value]) => isObject(value)
              ? {
                name,
                ...value
              }
              : {
                name,
                label: value
              }
          )
          : null
    },

    shouldRender(schema = null) {
      return !!schema && this.getSchemaValue('if', true, schema) ?? true
    },

    getComponent(dataPathOrKey) {
      return this.parentSchema.getComponent(dataPathOrKey)
    },

    showDialog(options, config) {
      // Shows a dito-dialog component through vue-js-modal, and wraps it in a
      // promise so that the buttons in the dialog can use `dialog.resolve()`
      // and `dialog.reject()` to close the modal dialog and resolve / reject
      // the promise at once.
      return new Promise((resolve, reject) => {
        this.$modal.show(DitoComponent.component('dito-dialog'), {
          ...options,
          promise: {
            resolve,
            reject
          }
        }, config)
      })
    },

    notify(...args) {
      const type = args.length > 1 ? args[0] : 'info'
      const title = args.length > 2 ? args[1] : {
        warning: 'Warning',
        error: 'Error',
        info: 'Information',
        success: 'Success'
      }[type] || 'Notification'
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
      }[type] || 'error'
      console[log](content)
    },

    closeNotifications() {
      this.rootComponent.closeNotifications()
    },

    getDragOptions(draggable) {
      return {
        animation: 150,
        disabled: !draggable,
        handle: '.dito-button-drag',
        ghostClass: 'dito-drag-ghost'
      }
    }
  }
}
