import { isNumber, isDate } from '@/base'

export const defaultNumberFormat = {
  style: 'decimal'
}

export const defaultDateFormat = {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
}

export const defaultTimeFormat = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
}

const defaults = {
  number: defaultNumberFormat,
  date: defaultDateFormat,
  time: defaultTimeFormat
}

export function format(value, { locale = 'en-US', ...options } = {}) {
  const getOptions = name => {
    const def = defaults[name]
    // Default option for both date and time is: `true` (see signature)
    const opt = options[name] ?? true
    return opt === true ? def
      : opt === false || opt === undefined ? {}
      : Object.entries({ ...def, ...opt }).reduce((opt, [key, value]) => {
        if (value !== false) {
          opt[key] = value
        }
        return opt
      }, {})
  }

  if (options.number) {
    value = isNumber(value) ? value : parseFloat(value)
  } else if (options.date || options.time) {
    value = isDate(value) ? value : new Date(value)
  }

  if (isNumber(value)) {
    options = getOptions('number')
    if (options.format) {
      // Support custom post-formatting of both time and date formats, e.g.
      // to replace separators and such:
      const parts = new Intl.NumberFormat(locale, options).formatToParts(value)
      return parts.map(
        ({ type, value }) => options.format(value, type, options) ?? value
      ).join('')
    }
  } else if (isDate(value)) {
    // Flatten the separate date / time options down to pone
    const opts = {
      date: getOptions('date'),
      time: getOptions('time')
    }
    options = { ...opts.date, ...opts.time }
    if (options.format) {
      // Support custom post-formatting of both time and date formats, e.g.
      // to replace separators and such:
      const parts = new Intl.DateTimeFormat(locale, options)
        .formatToParts(value)
      let modeOpts = null
      return parts.map(({ type, value }) => {
        if (type !== 'literal') {
          // Switch mode between date & time to pick the right format methdod:
          const mode = ['weekday', 'day', 'month', 'year'].includes(type)
            ? 'date'
            : 'time'
          modeOpts = opts[mode]
        }
        return modeOpts?.format?.(value, type, modeOpts) ?? value
      }).join('')
    }
  }
  return value?.toLocaleString?.(locale, options)
}

export function formatDate(value, options) {
  return format(value, options)
}
