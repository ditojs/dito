import { isObject } from '@ditojs/utils'
import { addEvents } from '@ditojs/ui/src'

// @vue/component
export default {
  created() {
    // Aborted when the component is unmounted, which removes all handlers that
    // are still added then. Not reactive, and nothing is kept per handler.
    this.domAbortController = new AbortController()
  },

  unmounted() {
    this.domAbortController.abort()
  },

  methods: {
    // Adds the event handlers to `element`, and returns an object with a
    // `remove()` method that removes them again. Handlers that are still added
    // when the component is unmounted are removed then.
    domOn(element, type, handler) {
      const events = isObject(type) ? type : { [type]: handler }
      return addEvents(element, events, {
        signal: this.domAbortController.signal
      })
    }
  }
}
