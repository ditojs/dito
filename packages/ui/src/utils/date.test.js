import {
  describeDate,
  alterDate,
  parseDate,
  getDatePartAtPosition
} from './date.js'

describe('parseDate()', () => {
  const date = { day: 'numeric', month: 'long', year: 'numeric' }
  const time = { hour: '2-digit', minute: '2-digit', second: '2-digit' }

  it.each([
    ['May 14, 2026', new Date(2026, 4, 14)],
    ['14 May 2026', new Date(2026, 4, 14)],
    ['05/14/2026', new Date(2026, 4, 14)],
    ['14.05.2026', new Date(2026, 4, 14)]
  ])('parses date %o', (string, expected) => {
    expect(parseDate(string, { date, time: null })).toEqual(expected)
  })

  it.each([
    ['May 14, 2026, 11:30:00 AM', new Date(2026, 4, 14, 11, 30, 0)],
    ['May 14, 2026, 11:30:00 PM', new Date(2026, 4, 14, 23, 30, 0)],
    ['May 14, 2026, 12:05:00 AM', new Date(2026, 4, 14, 0, 5, 0)],
    ['May 14, 2026, 12:05:00 PM', new Date(2026, 4, 14, 12, 5, 0)],
    ['14.05.2026, 23:30:00', new Date(2026, 4, 14, 23, 30, 0)]
  ])('parses datetime %o', (string, expected) => {
    expect(parseDate(string, { date, time })).toEqual(expected)
  })

  it('parses time %o', () => {
    expect(parseDate('11:30:00 PM', { date: null, time })).toEqual(
      new Date(2000, 0, 1, 23, 30, 0)
    )
  })

  it('rejects month names shorter than three letters as ambiguous', () => {
    expect(parseDate('Ma 14, 2026', { date, time: null })).toBe(null)
    expect(parseDate('Mar 14, 2026', { date, time: null })).toEqual(
      new Date(2026, 2, 14)
    )
  })

  it.each(['', 'May', 'Foo 14, 2026', '2026-05-14', '13/45/2026'])(
    'returns null for %o',
    string => {
      expect(parseDate(string, { date, time: null })).toBe(null)
    }
  )
})

describe('describeDate()', () => {
  it('describes the local date parts', () => {
    expect(describeDate(new Date(2026, 4, 14, 11, 30, 15, 250))).toEqual({
      year: 2026,
      month: 4,
      day: 14,
      hour: 11,
      minute: 30,
      second: 15,
      millisecond: 250
    })
  })

  it('describes missing dates with zeros', () => {
    expect(Object.values(describeDate(null))).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})

describe('alterDate()', () => {
  it('returns a new date with the overridden parts', () => {
    const date = new Date(2026, 4, 14, 11, 30)
    const altered = alterDate(date, { hour: 23, minute: 0 })
    expect(altered).toEqual(new Date(2026, 4, 14, 23, 0))
    expect(date).toEqual(new Date(2026, 4, 14, 11, 30))
  })

  it('rolls over out-of-range parts', () => {
    expect(alterDate(new Date(2026, 0, 31), { month: 1 })).toEqual(
      new Date(2026, 2, 3)
    )
  })
})

describe('getDatePartAtPosition()', () => {
  const string = 'May 14, 2026, 11:30:00 AM'

  it.each([
    [0, { name: 'month', start: 0, end: 3 }],
    [3, { name: 'month', start: 0, end: 3 }],
    [4, { name: 'day', start: 4, end: 6 }],
    // Separators belong to the part before them:
    [6, { name: 'day', start: 4, end: 6 }],
    [10, { name: 'year', start: 8, end: 12 }],
    [14, { name: 'hour', start: 14, end: 16 }],
    [18, { name: 'minute', start: 17, end: 19 }],
    [21, { name: 'second', start: 20, end: 22 }]
  ])('finds the part at position %o in US dates', (position, expected) => {
    expect(getDatePartAtPosition(string, position)).toEqual(expected)
  })

  it('finds the day first in other locales', () => {
    const options = { locale: 'de-DE' }
    expect(getDatePartAtPosition('14.05.2026', 0, options)).toEqual({
      name: 'day',
      start: 0,
      end: 2
    })
    expect(getDatePartAtPosition('14.05.2026', 3, options)).toEqual({
      name: 'month',
      start: 3,
      end: 5
    })
  })

  it('finds the parts of times without dates', () => {
    expect(
      getDatePartAtPosition('11:30:00', 4, { date: false })
    ).toEqual({ name: 'minute', start: 3, end: 5 })
  })

  it('returns `null` for missing strings', () => {
    expect(getDatePartAtPosition(null, 0)).toBe(null)
  })

  it('ignores the time parts of dates without time', () => {
    expect(
      getDatePartAtPosition('May 14, 2026, 11:30', 16, { time: false })
    ).toEqual({ name: 'year', start: 8, end: 12 })
  })
})
