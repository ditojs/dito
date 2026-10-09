import { parseFraction } from './math.js'

describe('parseFraction()', () => {
  it.each([
    ['1/2', 0.5],
    [' 3 / 4 ', 0.75],
    ['-1/4', -0.25],
    ['1/-4', -0.25],
    ['+2/1', 2]
  ])('parses the fraction %o as %o', (value, expected) => {
    expect(parseFraction(value)).toBe(expected)
  })

  it('parses other values as floats', () => {
    expect(parseFraction('0.25')).toBe(0.25)
    expect(parseFraction('50%')).toBe(50)
    expect(parseFraction(0.5)).toBe(0.5)
    expect(parseFraction('fill')).toBeNaN()
    expect(parseFraction('1.5/2')).toBe(1.5)
  })

  it('returns `Infinity` for divisions by zero', () => {
    expect(parseFraction('1/0')).toBe(Infinity)
  })
})
