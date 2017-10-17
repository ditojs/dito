import EventEmitter from 'eventemitter2'

// Expose only some of the EventEmitter methods and behavior on the model:
const {
  on, off, once, onAny, offAny, emitAsync: emit, _on, _onAny, _once
} = EventEmitter.prototype

const properties = {}
for (const [key, method] of Object.entries({
  on, off, once, onAny, offAny, emit, _on, _onAny, _once
})) {
  properties[key] = {
    value: method,
    writable: true,
    enumerable: false,
    configurable: true
  }
}

export default function (modelClass) {
  Object.defineProperties(modelClass, properties)
  EventEmitter.call(modelClass, {
    delimiter: ':',
    wildcard: true,
    newListener: false,
    maxListeners: 0
  })
}
