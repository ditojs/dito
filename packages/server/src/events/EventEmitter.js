import EventEmitter2 from 'eventemitter2'

// Expose only some of the EventEmitter methods and behavior on the model:
const {
  emitAsync: emit, on, off, once, onAny, offAny,
  removeListener, listeners,
  _on, _onAny, _once
} = EventEmitter2.prototype

const methods = {
  /* eslint object-property-newline: "off" */
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

export function EventEmitter(target) {
  Object.defineProperties(target, properties)
  EventEmitter2.call(target, {
    delimiter: ':',
    wildcard: true,
    newListener: false,
    maxListeners: 0
  })
  return target
}

export function DeferredEventEmitter(target) {
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
        return EventEmitter(this)[key](...args)
      }
    }
  }
  return target
}
