import { formatDate } from './date'

describe('formatDate()', () => {
  const date = new Date(2012, 5, 9, 22, 45, 30)
  const locale = 'en-US' // TODO: Test other locales once we move to Node 10

  it('should format dates with default settings for date and time', () => {
    expect(formatDate(date, { locale })).toBe('June 9, 2012, 10:45:30 PM')
  })

  it('should omit time when `options.time = false`', () => {
    expect(formatDate(date, { locale, time: false })).toBe('June 9, 2012')
  })

  it('should omit date when `options.date = false`', () => {
    expect(formatDate(date, { locale, date: false })).toBe('10:45:30 PM')
  })

  it('should support fine-grained control of `options.date`', () => {
    expect(
      formatDate(date, {
        locale,
        date: {
          month: 'short',
          day: false
        },
        time: false
      })
    ).toBe('Jun 2012')
  })
  expect(
    formatDate(date, {
      locale,
      date: {
        year: false,
        day: '2-digit'
      },
      time: false
    })
  ).toBe('June 09')
})
