import Vue from 'vue'
import DitoMixin from './mixins/DitoMixin'
import TypeMixin from './mixins/TypeMixin'
import { isArray, isFunction, isPromise, isString } from '@ditojs/utils'

const components = {}
const typeComponents = {}

const DitoComponent = Vue.extend({
  // Make sure that registered components are present in all DitoComponent.
  components,
  mixins: [DitoMixin],

  methods: {
    getTypeComponent(type) {
      return typeComponents[type] || null
    },

    resolveTypeComponent(component) {
      // A helper method to allow three things:
      // - When used in a computed property, it removes the need to have to
      //   load components with async functions `component: () => import(...)`.
      //   instead, they can be directly provided: `component: import(...)`
      // - The properties passed to such components don't need to be defined.
      //   Instead, the TypeMixin props are automatically inherited.
      // - The component can use all internal components known to dito-admin.
      return component
        ? async () => {
          // At first, resolve component is it is loaded asynchronously.
          let comp = isFunction(component) ? await component()
            : isPromise(component) ? await component
            : component
          comp = comp?.default || comp
          comp.mixins = [DitoMixin, TypeMixin]
          comp.components = components
          return comp
        }
        : component
    }
  }
})

// Extend Vue's $on() and $off() methods so that we can independently keep track
// of the events added / removed, and add a $responds() method that checks if
// the component responds to a given event.
// NOTE: We don't need to handle $once(), as that delegates to $on() and $off()
// See: https://github.com/vuejs/vue/issues/8757
const { $on, $off } = Vue.prototype

Object.assign(DitoComponent.prototype, {
  // eslint-disable-next-line vue/no-reserved-keys
  $on(event, callback) {
    if (isString(event)) {
      const events = this.$events || (this.$events = Object.create(null))
      ;(events[event] || (events[event] = [])).push(callback)
    }
    return $on.call(this, event, callback)
  },

  // eslint-disable-next-line vue/no-reserved-keys
  $off(event, callback) {
    if (!arguments.length) {
      // All events
      delete this.$events
    } else if (isString(event)) {
      // Specific event
      const callbacks = this.$events && this.$events[event]
      if (callbacks) {
        if (!callback) {
          // All handlers
          delete this.$events[event]
        } else {
          // Specific handler
          const index = callbacks.indexOf(callback)
          if (index !== -1) {
            callbacks.splice(index, 1)
          }
        }
      }
    }
    return $off.call(this, event, callback)
  },

  // Checks if the components responds to a given event type:
  $responds(event) {
    if (isArray(event)) {
      for (const ev of event) {
        if (this.$responds(ev)) {
          return true
        }
      }
      return false
    } else {
      return !!this.$events && event in this.$events
    }
  }
})

DitoComponent.typeComponents = typeComponents

DitoComponent.component = function(name, options) {
  if (options) {
    const ctor = this.extend(options)
    components[name] = ctor
    return ctor
  } else {
    return components[name] || Vue.component(name)
  }
}

export default DitoComponent
