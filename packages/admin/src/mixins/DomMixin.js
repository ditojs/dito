import { isObject } from '@ditojs/utils'
import { addEvents } from '@ditojs/ui'

// @vue/component
export default {
  data() {
    return {
      domHandlers: []
    }
  },

  beforeDestroy() {
    for (const { remove } of this.domHandlers) {
      remove()
    }
    this.domHandlers = []
  },

  methods: {
    domOn(element, type, handler) {
      const result = addEvents(
        element,
        isObject(type) ? type : { [type]: handler }
      )
      this.domHandlers.push(result)
      return result
    }
  }
}
