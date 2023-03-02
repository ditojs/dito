import { formatDate } from './formatDate.js'

describe('formatDate()', () => {
  const date = new Date(2012, 5, 9, 22, 45, 30)

  it('should not format null', () => {
    expect(formatDate(null, { locale: 'de-DE' })).toBe(null)
  })

  it('should use the en-US locale by default', () => {
    expect(formatDate(date)).toBe('June 9, 2012 at 10:45:30 PM')
    expect(formatDate(date, {})).toBe('June 9, 2012 at 10:45:30 PM')
  })

  it('should format dates with different locale and default options', () => {
    expect(formatDate(date, { locale: 'de-DE' }))
      .toBe('9. Juni 2012 um 22:45:30')
  })

  it('should format numbers or strings as dates', () => {
    expect(formatDate(0, { locale: 'de-DE' }))
      .toBe('1. Januar 1970 um 01:00:00')
    expect(formatDate(1000000000000, { locale: 'de-DE' }))
      .toBe('9. September 2001 um 03:46:40')
    expect(formatDate('04 Dec 1995 00:12:00 GMT', { locale: 'de-DE' }))
      .toBe('4. Dezember 1995 um 01:12:00')
  })
})
