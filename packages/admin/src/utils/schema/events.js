import { deprecate, hyphenate } from '@ditojs/utils'

export function getSchemaEventEntries(schema) {
  const entriesByEvent = {}
  for (const [key, callback] of Object.entries(schema)) {
    if (/^on[A-Z]/.test(key)) {
      const event = hyphenate(key.slice(2))
      entriesByEvent[event] = { key, event, callback }
    }
  }
  if (schema.events) {
    deprecate(
      'Schema `events` are deprecated, use the `on…` handlers instead, ' +
      'e.g. `onChange()` for `events: { change() }`.'
    )
    for (const [key, callback] of Object.entries(schema.events)) {
      const event = hyphenate(key)
      const entry = entriesByEvent[event]
      // The `on…` handlers win, also the defaults of buttons:
      if (!entry) {
        entriesByEvent[event] = { key, event, callback }
      } else if (process.env.NODE_ENV !== 'production') {
        // `deprecate()` logs each message once:
        deprecate(
          `Schema '${schema.name ?? schema.type}' ignores its deprecated ` +
          `\`events.${key}()\`, as \`${entry.key}()\` handles '${event}'.`
        )
      }
    }
  }
  return Object.values(entriesByEvent)
}
