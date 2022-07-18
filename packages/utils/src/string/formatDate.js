import { isDate } from '../base/index.js'
import { format } from './format.js'

export function formatDate(value, {
  locale = 'en-US',
  date = true,
  time = true
} = {}) {
  return format(
    isDate(value) || value == null ? value : new Date(value),
    { locale, date, time }
  )
}
