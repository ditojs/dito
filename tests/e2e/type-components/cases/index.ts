import { getCaseEntries } from './define.js'
import checked from './checked.js'
import code from './code.js'
import color from './color.js'
import date from './date.js'
import markup from './markup.js'
import number from './number.js'
import options from './options.js'
import slider from './slider.js'
import text from './text.js'
import textarea from './textarea.js'

export const caseEntries = getCaseEntries([
  ...text,
  ...textarea,
  ...number,
  ...checked,
  ...options,
  ...slider,
  ...color,
  ...date,
  ...markup,
  ...code
])

export function getCase(type: string, title: string) {
  const entry = caseEntries.find(
    entry => entry.type === type && entry.title === title
  )
  if (!entry) {
    throw new Error(`Case not found: ${type} '${title}'`)
  }
  return entry
}
