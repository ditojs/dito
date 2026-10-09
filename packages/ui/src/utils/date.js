export function describeDate(date) {
  return {
    year: date?.getFullYear() ?? 0,
    month: date?.getMonth() ?? 0,
    day: date?.getDate() ?? 0,
    hour: date?.getHours() ?? 0,
    minute: date?.getMinutes() ?? 0,
    second: date?.getSeconds() ?? 0,
    millisecond: date?.getMilliseconds() ?? 0
  }
}

export function alterDate(date, overrides = {}) {
  return new Date(...Object.values({ ...describeDate(date), ...overrides }))
}

// Returns `date` with its part `partName`, e.g. 'month', stepped by `step`.
// Stepping the year or the month clamps the day to the length of the new
// month, so that e.g. January 31 plus a month is February 29, not March 2.
export function stepDate(date, partName, step) {
  const parts = describeDate(date)
  parts[partName] += step
  if (partName === 'year' || partName === 'month') {
    parts.day = Math.min(parts.day, getDaysInMonth(parts.year, parts.month))
  }
  return alterDate(date, parts)
}

function getDaysInMonth(year, month) {
  // Day 0 of the next month is the last day of `month`, and `Date` rolls
  // `month` over into the next or previous year if it is out of range.
  return new Date(year, month + 1, 0).getDate()
}

export function parseDate(string, {
  locale = 'en-US',
  date = true,
  time = true
} = {}) {
  const timeDefault = time ? null : 0
  // Extract the 12-hour clock period, e.g. in en-US "11:30:00 AM".
  const period = string?.match(/\s*\b([ap])\.?m\.?$/i)
  if (period) {
    string = string.slice(0, period.index)
  }
  let [
    day,
    sep1,
    month,
    sep2,
    year,
    ,
    hour = timeDefault,
    ,
    minute = timeDefault,
    ,
    second = timeDefault,
    ,
    millisecond = timeDefault
  ] = getDateParts(string, { date, time })
  if (year && year.length >= 4) {
    if (
      // American format: MM/DD/YYYY
      (locale === 'en-US' && sep1 === '/' && sep2 === '/') ||
      // Month name first, e.g. en-US "May 14, 2026"
      (isNaN(+day) && !isNaN(+month))
    ) {
      ;[day, month] = [month, day]
    }
    if (period && hour !== null) {
      const pm = period[1].toLowerCase() === 'p'
      hour = (+hour % 12) + (pm ? 12 : 0)
      hour = String(hour).padStart(2, '0')
    }
    month = getMonthIndex(month, { locale })
    const isValidTimePart = part => part === null || part.length === 2
    if (
      month !== null && (
        !time || (
          isValidTimePart(hour) &&
          isValidTimePart(minute) &&
          isValidTimePart(second)
        )
      )
    ) {
      const result = new Date(
        +year,
        +month,
        +day,
        +hour,
        +minute,
        +second,
        +millisecond
      )
      // Reject invalid dates, including out-of-range parts that `Date` would
      // roll over, e.g. day 45.
      return result.getMonth() === +month && result.getDate() === +day
        ? result
        : null
    }
  }
  return null
}

export function getDatePartAtPosition(string, position, {
  locale = 'en-US',
  date = true,
  time = true
} = {}) {
  const parts = getDateParts(string, { date, time })

  const getPosition = (position, length = parts.length) => {
    let pos = 0
    let index = 0
    while ((position === null || pos <= position) && index < length) {
      pos += parts[index++]?.length ?? 0
    }
    return { position: pos, index }
  }

  // Time starts at index 6, due to the separator after the date.
  const offset = !date ? getPosition(null, 6).position : 0
  position += offset

  let { index } = getPosition(position)

  const isUS = locale === 'en-US'
  const values = [
    isUS ? 'month' : 'day',
    null,
    isUS ? 'day' : 'month',
    null,
    'year',
    null,
    'hour',
    null,
    'minute',
    null,
    'second',
    null,
    'millisecond'
  ]
  while (index--) {
    if (values[index]) {
      const start = getPosition(null, index).position - offset
      const end = start + parts[index].length
      return { name: values[index], start, end }
    }
  }
  return null
}

function getDateParts(string, { date = true, time = true } = {}) {
  const parts = string?.split(/([\s.,:/]+)/) || []
  if (!date) {
    // Add dummy date parts to make sure we get a time-only date.
    parts.unshift('1', '.', '1', '.', '2000', ' ')
  }
  if (!time && parts.length > 5) {
    parts.length = 5
  }
  return parts
}

function getMonthIndex(month, { locale = 'en-US' } = {}) {
  const value = +month
  if (!isNaN(value)) {
    return value - 1
  }
  const match = month.trim().toLowerCase()
  if (match.length < 3) return null
  const shortFormat = new Intl.DateTimeFormat(locale, { month: 'short' })
  const longFormat = new Intl.DateTimeFormat(locale, { month: 'long' })
  for (let i = 0; i < 12; i++) {
    const date = new Date(2000, i, 1)
    if (
      shortFormat.format(date).toLowerCase().startsWith(match) ||
      longFormat.format(date).toLowerCase().startsWith(match)
    ) {
      return i
    }
  }
  return null
}
