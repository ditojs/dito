import { parseDuration } from './duration.js'

describe('parseDuration()', () => {
  it.each([
    [1500, 1500],
    [0, 0],
    ['1500', 1500],
    ['250ms', 250],
    ['30s', 30000],
    ['5m', 300000],
    ['24h', 86400000],
    ['1.5h', 5400000],
    ['.5s', 500],
    ['2d', 172800000],
    ['1w', 604800000],
    ['1h30m', 5400000],
    ['1h 30m 15s', 5415000],
    ['2 days', 172800000],
    ['1 day', 86400000],
    ['1 Hour', 3600000],
    ['10 minutes', 600000],
    ['1 second', 1000],
    ['2 weeks', 1209600000],
    ['100 milliseconds', 100],
    [' 24H ', 86400000]
  ])('parses %o as %o milliseconds', (input, expected) => {
    expect(parseDuration(input)).toBe(expected)
  })

  it.each([
    '',
    'h',
    '1 year',
    '1hs',
    '1h30',
    '1h-30m',
    '1 toString',
    '1 constructor'
  ])('throws for %o', input => {
    expect(() => parseDuration(input)).toThrow(`Invalid duration: '${input}'.`)
  })
})
