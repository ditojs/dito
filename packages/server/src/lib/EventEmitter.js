import EventEmitter2 from 'eventemitter2'
import { asArray } from '@ditojs/utils'

export class EventEmitter extends EventEmitter2 {
  // Method for classes that use `EventEmitter.mixin()` to setup the emitter.
  setupEmitter(events, options) {
    EventEmitter2.call(this, {
      delimiter: ':',
      wildcard: false,
      newListener: false,
      maxListeners: 0,
      ...options
    })
    for (const key in events) {
      for (const part of key.split(',')) {
        const type = part.trim()
        for (const event of asArray(events[key])) {
          this.on(type, event)
        }
      }
    }
  }

  responds(type) {
    // TODO: See if this can be added to EventEmitter2 directly?
    // Related: https://github.com/EventEmitter2/EventEmitter2/pull/238
    return this._events && this._events[type]
  }

  emit(type, ...args) {
    // Only call emit if emitter actually responds to event. This prevents
    //  `_events` from being created when no events are installed.
    // See: https://github.com/EventEmitter2/EventEmitter2/pull/238
    return this.responds(type)
      // Always use async version to emit events: It will perform the same as
      // the normal one when the methods aren't actually async.
      ? this.emitAsync(type, ...args)
      : undefined
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
