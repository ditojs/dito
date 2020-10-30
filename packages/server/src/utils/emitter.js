export function emitAsync(emitter, event, ...args) {
  return Promise.all(
    emitter.listeners(event).map(
      listener => listener.call(emitter, ...args)
    )
  )
}
