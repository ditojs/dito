import appState from '@/appState'
import DitoComponent from '@/DitoComponent'
import { getItemParams } from '@/utils/item'
import {
  isObject, isArray, isString, isBoolean, isNumber, isFunction, isDate,
  isRegExp, asArray, camelize, labelize, hyphenate
} from '@ditojs/utils'

// @vue/component
export default {
  inject: [
    'api',
    '$verbs',
    '$routeComponent',
    '$schemaComponent'
  ],

  data() {
    return {
      appState,
      overrides: null,
      eventQueue: {}
    }
  },

  computed: {
    sourceSchema() {
      return this.meta?.schema
    },

    user() {
      return appState.user
    },

    verbs() {
      return this.$verbs
    },

    rootComponent() {
      return this.$root.$children[0]
    },

    routeComponent() {
      // Use computed properties as links to injects, so RouteMixin can
      // override the property and return `this` instead of the parent.
      return this.$routeComponent
    },

    formComponent() {
      const comp = this.routeComponent
      return comp?.isForm ? comp : null
    },

    schemaComponent() {
      // Use computed properties as links to injects, so DitoSchema can
      // override the property and return `this` instead of the parent.
      return this.$schemaComponent
    },

    // Returns the first route component in the chain of parents, including
    // this current component, that doesn't hold nested data.
    dataRouteComponent() {
      let { routeComponent } = this
      while (routeComponent?.isNested) {
        routeComponent = routeComponent.parentRouteComponent
      }
      return routeComponent
    },

    parentRouteComponent() {
      return this.routeComponent?.$parent.routeComponent
    },

    parentFormComponent() {
      return this.formComponent?.$parent.formComponent
    },

    parentSchemaComponent() {
      return this.schemaComponent?.$parent.schemaComponent
    },

    parentDataRouteComponent() {
      return this.dataRouteComponent?.$parent.dataRouteComponent
    },

    // Returns the data of the first route component in the chain of parents
    // that doesn't hold nested data.
    rootData() {
      return this.dataRouteComponent?.data
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
        value = this.data ? value.call(this, getItemParams(this)) : null
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
          labelize(name || schema.name)
        : labelize(name) || ''
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

    getButtonAttributes(name, button) {
      return {
        class: `dito-button-${name}`,
        title: this.getLabel(button, name)
      }
    },

    shouldRender(schema = null) {
      return !!schema && this.getSchemaValue('if', {
        type: Boolean,
        default: true,
        schema
      })
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

    load({ cache, ...options }) {
      // Allow caching of loaded data on two levels:
      // - 'global': cache globally, for the entire admin session
      // - 'local': cache locally within the current editing schema
      const cacheParent = {
        global: this.appState,
        local: this.schemaComponent
      }[cache]
      const loadCache = cacheParent?.loadCache
      // Build a cache key from the config:
      const cacheKey = loadCache && `${
        options.method || 'get'} ${
        options.url} ${
        JSON.stringify(options.params || '')} ${
        JSON.stringify(options.data || '')
      }`
      if (loadCache && (cacheKey in loadCache)) {
        return loadCache[cacheKey]
      }
      // NOTE: No await here, res is a promise that we can easily cache.
      const res = this.api.request(options)
        .then(response => response.data)
        .catch(error => {
          // Convert axios errors to normal errors
          const data = error.response?.data
          throw data
            ? Object.assign(new Error(data.message), data)
            : error
        })
      if (loadCache) {
        loadCache[cacheKey] = res
      }
      return res
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
    },

    setupSchemaFields() {
      this.setupMethods()
      this.setupComputed()
      this.setupEvents()
    },

    setupMethods() {
      for (const [key, value] of Object.entries(this.schema.methods || {})) {
        if (isFunction(value)) {
          this[key] = value
        } else {
          console.error(`Invalid method definition: ${key}: ${value}`)
        }
      }
    },

    setupComputed() {
      for (const [key, value] of Object.entries(this.schema.computed || {})) {
        const accessor = isFunction(value)
          ? { get: value }
          : isObject(value) && isFunction(value.get)
            ? value
            : null
        if (accessor) {
          Object.defineProperty(this, key, accessor)
        } else {
          console.error(
            `Invalid computed property definition: ${key}: ${value}`
          )
        }
      }
    },

    setupEvents() {
      const { watch, events } = this.schema
      if (watch) {
        const handlers = isFunction(watch) ? watch.call(this) : watch
        if (isObject(handlers)) {
          // Install the watch handlers in the next tick, so all components are
          // initialized and we can check against their names.
          this.$nextTick(() => {
            for (const [key, callback] of Object.entries(handlers)) {
              // Expand property names to 'data.property':
              const expr = key in this.schemaComponent.components
                ? `data.${key}`
                : key
              this.$watch(expr, callback)
            }
          })
        }
      }

      const addEvent = (key, event, callback) => {
        if (isFunction(callback)) {
          this.$on(event, callback)
        } else {
          console.error(`Invalid event definition: ${key}: ${callback}`)
        }
      }

      if (events) {
        for (const [key, value] of Object.entries(events)) {
          addEvent(key, key, value)
        }
      }
      // Also scan schema for `on[A-Z]`-style callbacks and add them
      for (const [key, value] of Object.entries(this.schema)) {
        if (/^on[A-Z]/.test(key)) {
          addEvent(key, hyphenate(key.substring(2)), value)
        }
      }
    },

    emitEvent(event, parent = null) {
      if (this.$responds(event) || parent?.$responds(event)) {
        // The effects of some events need some time to propagate through Vue.
        // Always use $nextTick() to make sure our handlers see these changes.
        // This is needed for 'change' on selects, 'load' events, etc.
        this.$nextTick(() => {
          const params = getItemParams(this)
          this.$emit(event, params)
          parent?.$emit(event, params)
        })
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
