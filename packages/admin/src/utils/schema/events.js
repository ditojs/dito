import { hyphenate } from '@ditojs/utils'

export function getSchemaEventEntries(schema) {
  const entries = []
  for (const [key, callback] of Object.entries(schema)) {
    if (/^on[A-Z]/.test(key)) {
      entries.push({ key, event: hyphenate(key.slice(2)), callback })
    }
  }
  return entries
}
