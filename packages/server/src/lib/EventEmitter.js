import EventEmitter2 from 'eventemitter2'

export class EventEmitter extends EventEmitter2 {
  // Method for classes that use `EventEmitter.mixin()` to setup the emitter.
  setupEmitter(events) {
    EventEmitter2.call(this, {
      delimiter: ':',
      wildcard: true,
      newListener: false,
      maxListeners: 0
    })
    for (const key in events) {
      const event = events[key]
      for (const type of key.split(',')) {
        this.on(type.trim(), event)
      }
    }
  }

  emit(...args) {
    // Always use async version to emit events: It will perform the same as the
    // normal one when the methods aren't actually async.
    return this.emitAsync(...args)
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
