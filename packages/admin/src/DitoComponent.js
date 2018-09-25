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
      // - The component can use all internal components known to Dito.js Admin.
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

// Also adds proper handling of async events, including a new async $emit() that
// deals with proper event queueing.

// NOTE: We don't need to handle $once(), as that delegates to $on() and $off()
// See: https://github.com/vuejs/vue/issues/8757
const { $on, $off, $emit } = Vue.prototype

Object.assign(DitoComponent.prototype, {
  // eslint-disable-next-line vue/no-reserved-keys
  $on(event, callback) {
    if (isString(event)) {
      const events = this.$events || (this.$events = Object.create(null))
      // Install an async-aware wrapper of the callback that awaits and calls
      // `next()` once its execution is done. See `$emit()` for details.
      const wrapper = async function(...args) {
        const next = args.pop()
        try {
          await wrapper.callback.call(this, ...args)
        } finally {
          next()
        }
      }
      wrapper.callback = callback
      const { wrappers } = events[event] || (events[event] = {
        wrappers: [],
        queue: []
      })
      wrappers.push(wrapper)
      callback = wrapper // Swap for the call below
    }
    return $on.call(this, event, callback)
  },

  // eslint-disable-next-line vue/no-reserved-keys
  $off(event, callback) {
    if (!arguments.length) {
      // Remove all events
      delete this.$events
    } else if (isString(event)) {
      // Remove specific event
      const entry = this.$events?.[event]
      if (entry) {
        if (!callback) {
          // Remove all handlers for this event
          delete this.$events[event]
        } else {
          // Remove a specific handler: find the index of its wrapper
          const { wrappers } = entry
          const index = wrappers.findIndex(
            wrapper => wrapper.callback === callback
          )
          if (index !== -1) {
            wrappers.splice(index, 1)
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
      return !!this.$events?.[event]
    }
  },

  async $emit(event, ...args) {
    // Only queue if it actually responds to it.
    const entry = this.$events?.[event]
    if (entry) {
      const { queue } = entry
      return new Promise(resolve => {
        const next = (first = false) => {
          if (!first) {
            // If the previous event is done, remove it from the queue.
            const entry = queue.shift()
            if (entry) {
              // Resolve the promise that was added to the queue for the event
              // that was just completed by the wrapper that called `next()`
              entry.resolve()
            }
          }
          // Emit the next event in the queue with its params.
          // Note that it only gets removed once `next()` is called.
          if (queue.length > 0) {
            // Pass on `next()` to the callback wrapper function that was
            // installed by the overridden `$on()` function above:
            $emit.call(this, event, ...queue[0].args, next)
          }
        }
        queue.push({ args, resolve })
        // With new queues (= only one entry), emit the first event immediately,
        // to get the queue running.
        if (queue.length === 1) {
          next(true)
        }
      })
    }
  }
})

DitoComponent.typeComponents = typeComponents

DitoComponent.component = function(name, options) {
  if (options) {
    options = {
      name,
      ...options
    }
    const ctor = this.extend(options)
    components[name] = ctor
    return ctor
  } else {
    return components[name] || Vue.component(name)
  }
}

export default DitoComponent
