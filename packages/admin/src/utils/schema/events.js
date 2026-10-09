import { hyphenate } from '@ditojs/utils'

// Returns the event handlers that `schema` defines, both in `events` and as
// `on[A-Z]` callbacks, e.g. `events: { mouseenter }` and `onMouseenter`, with
// the hyphenated event names that they are registered and emitted under.
// TODO: Deprecate one format or the other, in favour of only one way of
// doing things. Decide which one to remove.
export function getSchemaEventEntries(schema) {
  const entries = []
  for (const [key, callback] of Object.entries(schema.events || {})) {
    entries.push({ key, event: hyphenate(key), callback })
  }
  for (const [key, callback] of Object.entries(schema)) {
    if (/^on[A-Z]/.test(key)) {
      entries.push({ key, event: hyphenate(key.slice(2)), callback })
    }
  }
  return entries
}
