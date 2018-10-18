import { isObject } from '@ditojs/utils'

export default class Registry {
  constructor() {
    this._registry = Object.create(null)
    this._allowed = Object.create(null)
  }

  get(name) {
    return this._registry[name]
  }

  has(name) {
    return name in this._registry
  }

  register(name, handler) {
    if (isObject(name)) {
      for (const key in name) {
        this.register(key, name[key])
      }
    } else {
      this._registry[name] = handler
      this._allowed[name] = true
    }
  }

  allowed() {
    return this._allowed
  }
}
