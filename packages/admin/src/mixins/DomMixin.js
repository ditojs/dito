import { isObject } from '@/utils'

// TODO: Share functionality with lineto-frontend through module
export default {
  data() {
    return {
      domHandlers: {}
    }
  },

  beforeDestroy() {
    for (const [type, handlers] of Object.entries(this.domHandlers)) {
      for (const entry of handlers) {
        entry.element.removeEventListener(type, entry.handler, false)
      }
    }
  },

  methods: {
    domOn(element, type, handler) {
      if (isObject(type)) {
        for (const [key, value] of Object.entries(type)) {
          this.domOn(element, key, value)
        }
      } else {
        let handlers = this.domHandlers[type]
        if (!handlers) {
          handlers = this.domHandlers[type] = []
        }
        handlers.push({ element, handler })
        element.addEventListener(type, handler, false)
      }
    },

    domOff(element, type, handler) {
      if (isObject(type)) {
        for (const [key, value] of Object.entries(type)) {
          this.domOff(element, key, value)
        }
      } else {
        const handlers = this.domHandlers[type]
        if (handlers) {
          const index = handlers.findIndex(entry =>
            element === entry.element && handler === entry.handler)
          if (index !== -1) {
            handlers.splice(index, 1)
            element.removeEventListener(type, handler, false)
            if (!handlers.length) {
              delete this.domHandlers[type]
            }
          }
        }
      }
    }
  }
}
