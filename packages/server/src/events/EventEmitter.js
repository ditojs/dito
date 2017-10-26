import EventEmitter from 'eventemitter2'

/* eslint object-property-newline: "off" */
// Expose only some of the EventEmitter methods and behavior on the model:
const {
  emitAsync: emit, on, off, once, onAny, offAny,
  removeListener, listeners,
  _on, _onAny, _once
} = EventEmitter.prototype

const methods = {
  emit, on, off, once, onAny, offAny,
  removeListener, listeners,
  _on, _onAny, _once
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

export function mixinEventEmitter(target) {
  Object.defineProperties(target, properties)
  EventEmitter.call(target, {
    delimiter: ':',
    wildcard: true,
    newListener: false,
    maxListeners: 0
  })
  return target
}

export function mixinDeferredEventEmitter(target) {
  // Installs all public-facing methods except `emit()` as triggers that when
  // first called fully install the EventEmitter functionality, by which they
  // get replaced.
  // If no listeners are installed, `emit()` can do nothing until install() gets
  // called above:
  target.emit = () => {}
  for (const key in methods) {
    if (!/$(_|emit)/.test(key)) {
      target[key] = function (...args) {
        // Install the real EventEmitter functions on `this` instead of target,
        // to support inheritance, and call the newly installed function on it
        // again right after.
        return mixinEventEmitter(this)[key](...args)
      }
    }
  }
  return target
}
