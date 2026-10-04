import { getCaseEntries } from './define.js'
import color from './color.js'
import date from './date.js'
import text from './text.js'

export const caseEntries = getCaseEntries([...text, ...color, ...date])

export function getCase(type: string, title: string) {
  const entry = caseEntries.find(
    entry => entry.type === type && entry.title === title
  )
  if (!entry) {
    throw new Error(`Case not found: ${type} '${title}'`)
  }
  return entry
}
