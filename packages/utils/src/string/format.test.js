import { format } from './format.js'

describe('format()', () => {
  const integer = 123456789
  const float = 123456.789
  const date = new Date(2012, 5, 9, 22, 45, 30)

  it('should return undefined when no value is given', () => {
    expect(format()).toBe(undefined)
  })

  it('should return null when value is null', () => {
    expect(format(null)).toBe(null)
    expect(format(null, { number: true })).toBe(null)
    expect(format(null, { date: true })).toBe(null)
    expect(format(null, { time: true })).toBe(null)
  })

  it('should use the en-US locale by default', () => {
    expect(format(integer)).toBe('123,456,789')
    expect(format(float)).toBe('123,456.789')
    expect(format(date)).toBe('June 9, 2012, 10:45:30 PM')
  })

  it('should format numbers with different locale and default options', () => {
    expect(format(integer, { locale: 'de-DE' })).toBe('123.456.789')
    expect(format(float, { locale: 'de-DE' })).toBe('123.456,789')
  })

  it('should format dates with different locale and default options', () => {
    expect(format(date, { locale: 'de-DE' })).toBe('9. Juni 2012, 22:45:30')
  })

  it('should format string as numbers if told so', () => {
    expect(
      format('123456789', { locale: 'de-DE', number: true })
    ).toBe('123.456.789')
  })

  it('should format numbers as dates if told so', () => {
    expect(
      format(integer, { locale: 'de-DE', date: false, time: true })
    ).toBe('11:17:36')
    expect(
      format(integer, { locale: 'de-DE', date: true, time: false })
    ).toBe('2. Januar 1970')
    expect(
      format(integer, { locale: 'de-DE', date: true, time: true })
    ).toBe('2. Januar 1970, 11:17:36')
  })

  it('should omit time when `options.date = true`', () => {
    expect(
      format(date, { locale: 'de-DE', date: true })
    ).toBe('9. Juni 2012')
  })

  it('should omit date when `options.time = true`', () => {
    expect(
      format(date, { locale: 'de-DE', time: true })
    ).toBe('22:45:30')
  })

  it('should omit time when `options.time = false`', () => {
    expect(
      format(date, { locale: 'de-DE', time: false })
    ).toBe('9. Juni 2012')
  })

  it('should omit date when `options.date = false`', () => {
    expect(
      format(date, { locale: 'de-DE', date: false })
    ).toBe('22:45:30')
  })

  it(`should return an empty string when \`options.date = false\` and \`options.time = false\``, () => {
    expect(
      format(date, { locale: 'de-DE', date: false, time: false })
    ).toBe('')
  })

  it('should support fine-grained control of `options.number`', () => {
    expect(
      format(integer, {
        locale: 'de-DE',
        number: {
          style: 'currency',
          currency: 'EUR'
        }
      })
    ).toBe('123.456.789,00 €')
    expect(
      format(integer, {
        locale: 'de-CH',
        number: {
          style: 'currency',
          currency: 'CHF'
        }
      })
    ).toBe('CHF 123’456’789.00')
    expect(
      format(float, {
        locale: 'de-DE',
        number: {
          style: 'currency',
          currency: 'EUR'
        }
      })
    ).toBe('123.456,79 €')
    expect(
      format(float, {
        locale: 'de-CH',
        number: {
          style: 'currency',
          currency: 'CHF'
        }
      })
    ).toBe('CHF 123’456.79')
  })

  it('should support fine-grained control of `options.date`', () => {
    expect(
      format(date, {
        locale: 'de-DE',
        date: {
          month: 'short',
          day: false
        },
        time: false
      })
    ).toBe('Juni 2012')
    expect(
      format(date, {
        locale: 'de-DE',
        date: {
          year: false,
          day: '2-digit'
        },
        time: false
      })
    ).toBe('09. Juni')
  })

  it('should support custom `options.number.format()` overrides', () => {
    expect(
      format(integer, {
        locale: 'en-GB',
        number: {
          style: 'currency',
          currency: 'GBP',
          format: (value, type) => type === 'group'
            ? `’`
            : type === 'decimal'
              ? ','
              : undefined
        }
      })
    ).toBe(`£123’456’789,00`)
  })

  it(`should support custom \`options.date.format()\` and \`options.time.format()\` overrides`, () => {
    expect(
      format(date, {
        locale: 'en-GB',
        date: {
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
          format: (value, type, options) => (
            type === 'literal' && options.month === 'numeric'
              ? value.replace(/\//, '.').replace(/,/, '')
              : undefined
          )
        },
        time: {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          format: value => value.replace(/:/, '_')
        }
      })
    ).toBe('09.06.2012 22_45_30')
  })

  it('should handle string values', () => {
    expect(
      format('2016-05-24T15:54:14.876Z', { date: true })
    ).toBe('May 24, 2016')
    expect(
      format('2016-05-24T15:54:14.876Z', { date: true, time: true })
    ).toBe('May 24, 2016, 05:54:14 PM')
    expect(format('123456789', { number: true })).toBe('123,456,789')
    expect(format('123456.789', { number: true })).toBe('123,456.789')
    expect(format('Hello World')).toBe('Hello World')
  })
})
