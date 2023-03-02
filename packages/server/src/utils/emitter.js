import { mapConcurrently } from '@ditojs/utils'

export function emitAsync(emitter, event, ...args) {
  return mapConcurrently(
    emitter.listeners(event),
    listener => listener.call(emitter, ...args)
  )
}
