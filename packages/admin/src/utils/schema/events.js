import { deprecate, hyphenate } from '@ditojs/utils'

export function getSchemaEventEntries(schema) {
  const entriesByEvent = {}
  if (schema.events) {
    deprecate(
      'Schema `events` are deprecated, use the `on…` handlers instead, ' +
      'e.g. `onChange()` for `events: { change() }`.'
    )
    for (const [key, callback] of Object.entries(schema.events)) {
      const event = hyphenate(key)
      entriesByEvent[event] = { key, event, callback }
    }
  }
  for (const [key, callback] of Object.entries(schema)) {
    if (/^on[A-Z]/.test(key)) {
      const event = hyphenate(key.slice(2))
      // `events` replace the handlers of their events, e.g. button defaults:
      entriesByEvent[event] ??= { key, event, callback }
    }
  }
  return Object.values(entriesByEvent)
}
