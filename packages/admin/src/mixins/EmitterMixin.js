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
    // queues the events, see below.
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
        const { callbacks } = (listeners[event] ||= {
          callbacks: [],
          queue: []
        })
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

    emit(event, ...args) {
      // Only queue event if there actually are listeners for it.
      const entry = this.listeners?.[event]
      if (!entry) {
        // Make sure it's thenable even if there are no listeners.
        return Promise.resolve()
      }
      const { queue, callbacks } = entry
      // Handles the queued events one after the other, each with all its
      // callbacks, so that the async callbacks of successive emits of the event
      // don't overlap.
      // NOTE: A callback that awaits the emit of the same event on the same
      // component would wait for itself, as its event is queued after its own.
      const handleQueue = async () => {
        // The event at the head of the queue only gets removed once all its
        // callbacks are done, so that `emit()` calls in the meantime only
        // queue their events.
        const { args, resolve } = queue[0]
        let result
        const errors = []
        // Iterate over a copy, since callbacks registered with `once()` remove
        // themselves from `callbacks` while it is being iterated.
        for (const callback of [...callbacks]) {
          try {
            const res = await callback.apply(this, args)
            if (res !== undefined) {
              result = res
            }
          } catch (error) {
            errors.push(error)
          }
        }
        resolve(
          errors.length > 0
            ? Promise.reject(
                new AggregateError(
                  errors,
                  `Errors during event handler for '${event}'`
                )
              )
            : result
        )
        queue.shift()
        if (queue.length > 0) {
          handleQueue()
        }
      }
      return new Promise(resolve => {
        queue.push({ args, resolve })
        // Only start handling the queue if it was empty, otherwise the event
        // is handled once the events queued before it are done.
        if (queue.length === 1) {
          handleQueue()
        }
      })
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
