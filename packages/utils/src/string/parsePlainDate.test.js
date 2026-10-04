import { parsePlainDate } from './parsePlainDate.js'

describe('parsePlainDate()', () => {
  it('should parse plain dates as local midnight', () => {
    expect(parsePlainDate('2026-05-14')).toEqual(new Date(2026, 4, 14))
    expect(parsePlainDate('1850-07-01')).toEqual(new Date(1850, 6, 1))
  })

  it('should return null for other values', () => {
    expect(parsePlainDate(null)).toBe(null)
    expect(parsePlainDate('')).toBe(null)
    expect(parsePlainDate('2026-05-14T00:00:00.000Z')).toBe(null)
    expect(parsePlainDate('14.05.2026')).toBe(null)
  })

  it('should return null for invalid dates', () => {
    expect(parsePlainDate('2026-02-30')).toBe(null)
    expect(parsePlainDate('2026-13-01')).toBe(null)
  })
})
