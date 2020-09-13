import { formatDate } from './formatDate'

describe('formatDate()', () => {
  const date = new Date(2012, 5, 9, 22, 45, 30)

  it('should return undefined when no date is given', () => {
    expect(formatDate()).toBe(undefined)
  })

  it('should use the en-US locale by default', () => {
    expect(formatDate(date)).toBe('June 9, 2012, 10:45:30 PM')
    expect(formatDate(date, {})).toBe('June 9, 2012, 10:45:30 PM')
  })

  it('should format dates with different locale and default options', () => {
    expect(formatDate(date, { locale: 'de-DE' })).toBe('9. Juni 2012, 22:45:30')
  })

  it('should omit time when `options.time = false`', () => {
    expect(
      formatDate(
        date,
        {
          locale: 'de-DE',
          time: false
        }
      )
    ).toBe('9. Juni 2012')
  })

  it('should omit date when `options.date = false`', () => {
    expect(
      formatDate(
        date,
        {
          locale: 'de-DE',
          date: false
        }
      )
    ).toBe('22:45:30')
  })

  it('should support fine-grained control of `options.date`', () => {
    expect(
      formatDate(date, {
        locale: 'de-DE',
        date: {
          month: 'short',
          day: false
        },
        time: false
      })
    ).toBe('Juni 2012')
    expect(
      formatDate(date, {
        locale: 'de-DE',
        date: {
          year: false,
          day: '2-digit'
        },
        time: false
      })
    ).toBe('09. Juni')
  })

  it('should support custom format() overrides', () => {
    expect(
      formatDate(date, {
        locale: 'en-GB',
        date: {
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
          format: (value, type, options) => (
            type === 'literal' && options.month === 'numeric'
              ? value.replace(/\//, '.').replace(/,/, '')
              : value
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
})
