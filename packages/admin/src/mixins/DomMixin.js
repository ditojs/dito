import { isObject } from '@ditojs/utils'
import { addEvents } from '@ditojs/ui/src'

// @vue/component
export default {
  data() {
    return {
      domHandlers: []
    }
  },

  unmounted() {
    // Copy the handlers, as `remove()` removes them from `domHandlers`:
    for (const { remove } of [...this.domHandlers]) {
      remove()
    }
  },

  methods: {
    // Adds the event handlers to `element`, and returns an object with a
    // `remove()` method that removes them again. Handlers that are still added
    // when the component is unmounted are removed then.
    domOn(element, type, handler) {
      const events = addEvents(
        element,
        isObject(type) ? type : { [type]: handler }
      )
      const handlers = {
        remove: () => {
          events.remove()
          const index = this.domHandlers.indexOf(handlers)
          if (index !== -1) {
            this.domHandlers.splice(index, 1)
          }
        }
      }
      this.domHandlers.push(handlers)
      return handlers
    }
  }
}
