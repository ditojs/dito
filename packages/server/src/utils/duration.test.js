import { getDuration, addDuration, subtractDuration } from './duration.js'

describe('getDuration()', () => {
  it('returns numbers as milliseconds unchanged', () => {
    expect(getDuration(1500)).toBe(1500)
    expect(getDuration(0)).toBe(0)
  })

  it('parses duration strings to milliseconds', () => {
    expect(getDuration('1s')).toBe(1000)
    expect(getDuration('2h')).toBe(2 * 60 * 60 * 1000)
    expect(getDuration('1d 12h')).toBe(36 * 60 * 60 * 1000)
  })

  it('returns null for unparsable strings', () => {
    expect(getDuration('soon')).toBe(null)
  })
})

describe('addDuration()', () => {
  it('adds the duration to the date in place', () => {
    const date = new Date('2026-01-01T00:00:00.000Z')
    const result = addDuration(date, '1h 30m')
    expect(result).toBe(date)
    expect(date.toISOString()).toBe('2026-01-01T01:30:00.000Z')
  })

  it('adds numeric durations as milliseconds', () => {
    const date = new Date('2026-01-01T00:00:00.000Z')
    addDuration(date, 250)
    expect(date.toISOString()).toBe('2026-01-01T00:00:00.250Z')
  })

  it('crosses month and year boundaries', () => {
    const date = new Date('2026-12-31T23:00:00.000Z')
    addDuration(date, '2h')
    expect(date.toISOString()).toBe('2027-01-01T01:00:00.000Z')
  })
})

describe('subtractDuration()', () => {
  it('subtracts the duration from the date in place', () => {
    const date = new Date('2026-03-01T00:00:00.000Z')
    const result = subtractDuration(date, '1d')
    expect(result).toBe(date)
    expect(date.toISOString()).toBe('2026-02-28T00:00:00.000Z')
  })

  it('subtracts numeric durations as milliseconds', () => {
    const date = new Date('2026-03-01T00:00:00.000Z')
    subtractDuration(date, 1000)
    expect(date.toISOString()).toBe('2026-02-28T23:59:59.000Z')
  })
})
