import { parseDate } from './date.js'

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

  it.each(['', 'May', 'Foo 14, 2026', '2026-05-14', '13/45/2026'])(
    'returns null for %o',
    string => {
      expect(parseDate(string, { date, time: null })).toBe(null)
    }
  )
})
