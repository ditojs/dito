import { isDate } from '@ditojs/utils'

export function copyDate(date, {
  year = date?.getFullYear() ?? 0,
  month = date?.getMonth() ?? 0,
  day = date?.getDate() ?? 0,
  hour = date?.getHours() ?? 0,
  minute = date?.getMinutes() ?? 0,
  second = date?.getSeconds() ?? 0,
  millisecond = date?.getMilliseconds() ?? 0
} = {}) {
  return new Date(year, month, day, hour, minute, second, millisecond)
}

export function convertDate(date) {
  return isDate(date) ? date : date ? new Date(date) : null
}

export function parseDate(string, {
  locale = 'en-US',
  date = true,
  time = true
} = {}) {
  const timeDefault = time ? null : 0
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
    if (locale === 'en-US' && sep1 === '/' && sep2 === '/') {
      // American format: MM/DD/YYYY
      ;[day, month] = [month, day]
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
      return new Date(
        +year,
        +month,
        +day,
        +hour,
        +minute,
        +second,
        +millisecond
      )
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
    // eslint-disable-next-line no-unmodified-loop-condition
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
