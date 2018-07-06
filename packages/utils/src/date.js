export function formatDate(date, options = {
  locale: 'en-US',
  date: true,
  time: true
}) {
  const defaults = {
    date: { day: 'numeric', month: 'long', year: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit', second: '2-digit' }
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
  return new Date(date).toLocaleString(options.locale || 'en-US', {
    ...getOptions('date'),
    ...getOptions('time')
  })
}
