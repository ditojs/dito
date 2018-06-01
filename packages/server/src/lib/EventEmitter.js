import EventEmitter from 'eventemitter2'

// Expose only some of the EventEmitter methods and behavior on the model:
const {
  emitAsync: emit, on, off, once, onAny, offAny,
  removeListener, listeners,
  _on, _onAny, _once, _many
} = EventEmitter.prototype

const methods = {
  /* eslint object-property-newline: "off" */
  emit, on, off, once, onAny, offAny,
  removeListener, listeners,
  _on, _onAny, _once, _many
}

const properties = {}
for (const [key, method] of Object.entries(methods)) {
  properties[key] = {
    value: method,
    writable: true,
    enumerable: false,
    configurable: true
  }
}

EventEmitter.mixin = function(target) {
  Object.defineProperties(target, properties)
  EventEmitter.call(target, {
    delimiter: ':',
    wildcard: true,
    newListener: false,
    maxListeners: 0
  })
}

EventEmitter.deferred = function(target) {
  // Installs all public-facing methods except `emit()` as triggers that when
  // first called fully install the EventEmitter functionality, by which they
  // get replaced. If no listeners are installed, `emit()` can do nothing until
  // EventEmitter.mixin() gets called in one of the triggers:
  target.emit = () => {}
  for (const key in methods) {
    if (!/$(_|emit)/.test(key)) {
      target[key] = function(...args) {
        // Install the real EventEmitter functions on `this` instead of target,
        // to support events on sub-classes of target also.
        // Then call the newly installed function on it again right after.
        EventEmitter.mixin(this)
        return this[key](...args)
      }
    }
  }
}

export { EventEmitter }
