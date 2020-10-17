import { isDate } from '@/base'
import { format } from './format'

export function formatDate(value, {
  locale = 'en-US',
  date = true,
  time = true
} = {}) {
  return format(isDate(value) ? value : new Date(value), { locale, date, time })
}
