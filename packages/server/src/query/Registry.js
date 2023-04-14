import { isObject } from '@ditojs/utils'

export default class Registry {
  #registry = Object.create(null)
  #allowed = Object.create(null)

  get(name) {
    return this.#registry[name]
  }

  has(name) {
    return name in this.#registry
  }

  register(name, handler) {
    if (isObject(name)) {
      for (const key in name) {
        this.register(key, name[key])
      }
    } else {
      this.#registry[name] = handler
      this.#allowed[name] = true
    }
  }

  getAllowed() {
    return this.#allowed
  }
}
