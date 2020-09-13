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

export function formatDate(date, options = {
  locale: 'en-US',
  date: true,
  time: true
}) {
  const defaults = {
    date: defaultDateFormat,
    time: defaultTimeFormat
  }

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

  if (date) {
    const locale = options.locale || 'en-US'
    const opts = {
      date: getOptions('date'),
      time: getOptions('time')
    }
    const mergedOpts = {
      ...opts.date,
      ...opts.time
    }
    if (mergedOpts.format) {
      // Support custom post-formatting of both time and date formats, e.g.
      // to replace separators and such:
      const parts = new Intl.DateTimeFormat(locale, mergedOpts)
        .formatToParts(new Date(date))
      let modeOpts = null
      return parts.map(({ type, value }) => {
        if (type !== 'literal') {
          const mode = ['weekday', 'day', 'month', 'year'].includes(type)
            ? 'date'
            : 'time'
          modeOpts = opts[mode]
        }
        return modeOpts?.format?.(value, type, modeOpts) ?? value
      }).join('')
    } else {
      return new Date(date).toLocaleString(locale, mergedOpts)
    }
  }
}
