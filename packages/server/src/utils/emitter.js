export function emitAsync(emitter, event, ...args) {
  return Promise.map(
    emitter.listeners(event),
    listener => listener.call(emitter, ...args)
  )
}
