import { isObject } from '@ditojs/utils'

export default function () {
  const registry = Object.create(null)
  return {
    get(name) {
      return registry[name]
    },

    has(name) {
      return name in registry
    },

    keys() {
      return Object.keys(registry)
    },

    register(name, handler) {
      if (isObject(name)) {
        Object.assign(registry, name)
      } else {
        registry[name] = handler
      }
    }
  }
}
