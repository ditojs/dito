import { isNumber, isDate, isObject } from '@/base'

export const defaultFormats = {
  number: {
    style: 'decimal'
  },
  date: {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  },
  time: {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }
}

export function format(value, { locale = 'en-US', number, date, time } = {}) {
  const formatOptions = { number, date, time }
  const getOptions = name => {
    const def = defaultFormats[name]
    const opt = formatOptions[name] ?? true
    return opt === true
      ? def
      : isObject(opt)
        ? Object.entries({ ...def, ...opt }).reduce((opt, [key, value]) => {
          if (value !== false) {
            opt[key] = value
          }
          return opt
        }, {})
        : {}
  }

  if (number) {
    value = isNumber(value) ? value : parseFloat(value)
  } else if (date || time) {
    value = isDate(value) ? value : new Date(value)
  }

  let options
  if (isNumber(value) && number !== false) {
    options = getOptions('number')
    if (options.format) {
      // Support custom post-formatting of number formats,
      // e.g. to replace decimals and such:
      const parts = new Intl.NumberFormat(locale, options).formatToParts(value)
      return parts.map(({ type, value }) =>
        options.format(value, type, options) ?? value
      ).join('')
    }
  } else if (isDate(value) && (date !== false || time !== false)) {
    // Flatten the separate date / time options down to one
    const opts = {
      date: getOptions('date'),
      time: getOptions('time')
    }
    options = {
      ...opts.date,
      ...opts.time
    }
    if (options.format) {
      // Support custom post-formatting of both time and date formats,
      // e.g. to replace separators and such:
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
  return value !== undefined
    ? options
      ? value.toLocaleString?.(locale, options)
      : ''
    : value
}
