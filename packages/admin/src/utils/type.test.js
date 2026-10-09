import { isMatchingType, convertType } from './type.js'

describe('isMatchingType()', () => {
  it('matches values against any of the types', () => {
    expect(isMatchingType([Number, String], 'a')).toBe(true)
    expect(isMatchingType([Number, String], 1)).toBe(true)
    expect(isMatchingType([Number, String], true)).toBe(false)
    expect(isMatchingType([Boolean], false)).toBe(true)
    expect(isMatchingType([Date], new Date())).toBe(true)
    expect(isMatchingType([Array], [])).toBe(true)
    expect(isMatchingType([Object], {})).toBe(true)
    expect(isMatchingType([Object], [])).toBe(false)
    expect(isMatchingType([RegExp], /a/)).toBe(true)
    expect(isMatchingType([Function], () => {})).toBe(true)
  })

  it('never matches `null`, `undefined`, or missing types', () => {
    expect(isMatchingType([Object], null)).toBe(false)
    expect(isMatchingType([String], undefined)).toBe(false)
    expect(isMatchingType(null, 'a')).toBe(false)
    expect(isMatchingType([], 'a')).toBe(false)
  })

  it('does not match types without a checker', () => {
    expect(isMatchingType([Symbol], Symbol('a'))).toBe(false)
  })
})

describe('convertType()', () => {
  it('converts to primitive types', () => {
    expect(convertType(Boolean, '')).toBe(false)
    expect(convertType(Boolean, 'false')).toBe(true)
    expect(convertType(Number, '1.5')).toBe(1.5)
    expect(convertType(Number, 'a')).toBeNaN()
    expect(convertType(String, 12)).toBe('12')
  })

  it('accepts type names as well as types', () => {
    expect(convertType('Number', '2')).toBe(2)
  })

  it('converts to dates, keeping dates', () => {
    const date = new Date(2020, 0, 1)
    expect(convertType(Date, date)).toBe(date)
    expect(convertType(Date, '2020-01-01T00:00:00Z').toISOString()).toBe(
      '2020-01-01T00:00:00.000Z'
    )
  })

  it('converts comma-separated strings and other values to arrays', () => {
    const array = [1]
    expect(convertType(Array, array)).toBe(array)
    expect(convertType(Array, 'a,b')).toEqual(['a', 'b'])
    expect(convertType(Array, 1)).toEqual([1])
  })

  it('converts `true` to an empty object, and other non-objects to `null`', () => {
    const object = { a: 1 }
    expect(convertType(Object, object)).toBe(object)
    expect(convertType(Object, true)).toEqual({})
    expect(convertType(Object, false)).toBe(null)
    expect(convertType(Object, 'a')).toBe(null)
  })

  it('converts strings to regular expressions', () => {
    const regexp = /a/
    expect(convertType(RegExp, regexp)).toBe(regexp)
    expect(convertType(RegExp, '^a+$').test('aaa')).toBe(true)
  })

  it('keeps values of types without a converter', () => {
    const fn = () => {}
    expect(convertType(Function, fn)).toBe(fn)
    expect(convertType(null, 'a')).toBe('a')
  })
})
