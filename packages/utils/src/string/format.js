import { isNumber, isDate, isObject } from '../base/index.js'

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

export function format(value, {
  locale = 'en-US',
  number,
  date,
  time,
  defaults = defaultFormats
} = {}) {
  const formats = { number, date, time }
  const defaultValue = number || date || time ? undefined : true
  const getOptions = name => {
    const defaultOption = defaults[name]
    const option = formats[name] ?? defaultValue
    return option === true
      ? defaultOption
      : isObject(option)
        ? Object.entries({
          ...defaultOption,
          ...option
        }).reduce((opt, [key, value]) => {
          if (value !== false) {
            opt[key] = value
          }
          return opt
        }, {})
        : {}
  }

  if (value != null) {
    if (number) {
      value = isNumber(value) ? value : parseFloat(value)
    } else if (date || time) {
      value = isDate(value) ? value : new Date(value)
    }
  }

  let options
  if (isNumber(value)) {
    if (number === false) {
      return ''
    } else {
      options = getOptions('number')
      if (options.format) {
        // Support custom post-formatting of number formats,
        // e.g. to replace decimals and such:
        const parts = new Intl.NumberFormat(locale, options)
          .formatToParts(value)
        return parts.map(({ type, value }) =>
          options.format(value, type, options) ?? value
        ).join('')
      }
    }
  } else if (isDate(value)) {
    if (date === false && time === false) {
      return ''
    } else {
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
  }
  return value != null
    ? value.toLocaleString(locale, options)
    : value
}
