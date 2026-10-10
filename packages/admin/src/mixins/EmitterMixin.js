import { isArray, isPlainObject } from '@ditojs/utils'

// @vue/component
export default {
  data() {
    return {
      listeners: null
    }
  },

  methods: {
    // on() and off() methods that keep track of the events added / removed,
    // and a hasListeners() method that checks if the component has listeners
    // for a given event.

    // Also adds proper handling of async events, through an async emit() that
    // awaits the callbacks, see below.
    on(event, callback) {
      if (isArray(event)) {
        for (const ev of event) {
          this.on(ev, callback)
        }
      } else if (isPlainObject(event)) {
        for (const key in event) {
          this.on(key, event[key])
        }
      } else {
        const listeners = (this.listeners ||= Object.create(null))
        const { callbacks } = (listeners[event] ||= { callbacks: [] })
        callbacks.push(callback)
      }
      return this
    },

    once(event, callback) {
      const on = (...args) => {
        this.off(event, on)
        return callback.apply(this, args)
      }
      on.callback = callback // Needed for `off()`, see below.
      return this.on(event, on)
    },

    off(event, callback) {
      if (!arguments.length) {
        // Remove all events. Reset rather than `delete` the data property,
        // which Vue's component proxy doesn't support.
        this.listeners = null
      } else if (isArray(event)) {
        for (const ev of event) {
          this.off(ev, callback)
        }
      } else if (isPlainObject(event)) {
        for (const key in event) {
          this.off(key, event[key])
        }
      } else {
        // Remove specific event
        const entry = this.listeners?.[event]
        if (entry) {
          if (!callback) {
            // Remove all handlers for this event
            delete this.listeners[event]
          } else {
            // Remove a specific handler: find the index in callbacks
            const { callbacks } = entry
            const index = callbacks.findIndex(
              // Match `cb.callback` also, as used by `once()`, see  above:
              cb => cb === callback || cb.callback === callback
            )
            if (index !== -1) {
              callbacks.splice(index, 1)
            }
          }
        }
      }
      return this
    },

    // Calls the callbacks of the event one after the other, awaiting each, and
    // resolves with the last result that isn't undefined, or rejects with an
    // `AggregateError` of all errors thrown. Separate emits don't wait for
    // each other, so that a callback can await an emit of its own event
    // without waiting for itself. Callbacks added to or removed from the
    // event's callbacks during the emit are respected, e.g. a callback
    // registered by an earlier one is called, and one removed by `off()` or
    // `once()` in a concurrent emit isn't.
    async emit(event, ...args) {
      const callbacks = this.listeners?.[event]?.callbacks
      if (!callbacks) {
        return
      }
      let result
      const errors = []
      // Iterate over the live `callbacks`, so that callbacks added or removed
      // during the emit are respected.
      for (let index = 0; index < callbacks.length; index++) {
        const callback = callbacks[index]
        try {
          const callbackResult = await callback.apply(this, args)
          if (callbackResult !== undefined) {
            result = callbackResult
          }
        } catch (error) {
          errors.push(error)
        }
        // A callback removed during the call, e.g. this one through `once()`,
        // moved the following ones down by one, so look at its index again:
        if (callbacks[index] !== callback) {
          index--
        }
      }
      if (errors.length > 0) {
        throw new AggregateError(
          errors,
          `Errors during event handler for '${event}'`
        )
      }
      return result
    },

    // Checks if the component has listeners for a given event type:
    hasListeners(event) {
      if (isArray(event)) {
        for (const ev of event) {
          if (!this.hasListeners(ev)) {
            return false
          }
        }
        return event.length > 0
      } else {
        return !!this.listeners?.[event]
      }
    },

    delegate(event, target) {
      if (target) {
        if (isArray(event)) {
          for (const ev of event) {
            this.delegate(ev, target)
          }
        } else {
          this.on(event, (...args) => target.emit(event, ...args))
        }
      }
      return this
    }
  }
}
