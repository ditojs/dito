import EventEmitter2 from 'eventemitter2'
import { isPlainObject, isString, isArray, asArray } from '@ditojs/utils'

export class EventEmitter extends EventEmitter2 {
  // Method for classes that use `EventEmitter.mixin()` to setup the emitter.
  _setupEmitter(events, options) {
    EventEmitter2.call(this, {
      delimiter: ':',
      maxListeners: 0,
      ...options
    })
    for (const key in events) {
      for (const part of key.split(',')) {
        const event = part.trim()
        for (const callback of asArray(events[key])) {
          this.on(event, callback)
        }
      }
    }
  }

  emit(event, ...args) {
    // Always use async version to emit events: It will perform the same as
    // the normal one when the methods aren't actually async.
    return this.emitAsync(event, ...args)
  }

  _handle(method, event, callback) {
    if (isString(event)) {
      super[method](event, callback)
    } else if (isArray(event)) {
      for (const ev of event) {
        super[method](ev, callback)
      }
    } else if (isPlainObject(event)) {
      for (const key in event) {
        super[method](key, event[key])
      }
    }
    return this
  }

  on(event, callback) {
    return this._handle('on', event, callback)
  }

  off(event, callback) {
    return this._handle('off', event, callback)
  }

  once(event, callback) {
    return this._handle('once', event, callback)
  }

  static mixin(target) {
    Object.defineProperties(target, properties)
  }
}

const {
  constructor, // Don't extract constructor, but everything else
  ...properties
} = {
  ...Object.getOwnPropertyDescriptors(EventEmitter2.prototype),
  ...Object.getOwnPropertyDescriptors(EventEmitter.prototype)
}
