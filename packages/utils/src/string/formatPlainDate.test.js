import { formatPlainDate } from './formatPlainDate.js'

describe('formatPlainDate()', () => {
  it('should format the local plain date', () => {
    expect(formatPlainDate(new Date(2026, 4, 14))).toBe('2026-05-14')
    expect(formatPlainDate(new Date(2026, 4, 14, 23, 59))).toBe(
      '2026-05-14'
    )
    expect(formatPlainDate(new Date(987, 0, 1))).toBe('0987-01-01')
    // Local mean time, with an offset in seconds in some timezones:
    expect(formatPlainDate(new Date(1850, 6, 1))).toBe('1850-07-01')
  })
})
