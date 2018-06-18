import appState from '@/appState'
import DitoComponent from '@/DitoComponent'
import {
  isObject, isArray, isString, isBoolean, isNumber, isFunction, isDate,
  isRegExp, asArray, camelize, labelize
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

    getSchemaValue(key, { type, default: def, schema = this.schema } = {}) {
      let value = schema?.[key]
      if (value === undefined && def !== undefined) {
        return def
      }

      const types = type && asArray(type)
      const isMatchingType = value => {
        // See if any of the expect types match, return immediately if they do:
        if (types && value != null) {
          for (const type of types) {
            if (typeCheckers[type.name]?.(value)) {
              return true
            }
          }
        }
        return false
      }

      if (isMatchingType(value)) {
        return value
      }
      // Any schema value handled through `getSchemaValue()` can provide
      // a function that's resolved when the value is evaluated:
      if (isFunction(value)) {
        // Only call the callback if we actually have data already
        value = this.data ? value.call(this, this.data) : null
      }
      // For boolean values that are defined as strings or arrays,
      // interpret the values as user roles and match against user:
      if (type === Boolean && (isString(value) || isArray(value))) {
        value = this.user.hasRole(...asArray(value))
      }
      // Now finally see if we can convert to the expect types.
      if (value != null && !isMatchingType(value)) {
        const converter = types && typeConverters[types[0].name]
        value = converter ? converter(value) : value
      }
      return value
    },

    getLabel(schema, name) {
      return schema
        ? this.getSchemaValue('label', { type: String, schema }) ||
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
      return !!schema && this.getSchemaValue('if', {
        type: Boolean,
        default: true,
        schema
      })
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

const typeCheckers = {
  Boolean: value => isBoolean(value),
  Number: value => isNumber(value),
  String: value => isString(value),
  Date: value => isDate(value),
  Array: value => isArray(value),
  RegExp: value => isRegExp(value)
}

const typeConverters = {
  Boolean: value => !!value,
  Number: value => +value,
  String: value => isString(value) ? value : `${value}`,
  Date: value => isDate(value) ? value : new Date(value),
  Array: value => isArray(value)
    ? value
    : isString(value)
      ? value.split(',')
      : asArray(value),
  RegExp: value => isRegExp(value)
    ? value
    : new RegExp(value)
}
