import { mapKeys } from './mapKeys'

describe('mapKeys()', () => {
  const array = [1, 2]
  const object = { a: 1, b: 2 }

  it('should map keys in `object` to a new object', () => {
    const actual = mapKeys(object, String)
    expect(actual).toStrictEqual({ 1: 1, 2: 2 })
  })

  it('should treat arrays like objects', () => {
    const actual = mapKeys(array, String)
    expect(actual).toStrictEqual({ 1: 1, 2: 2 })
  })

  it('should work with property names for `iteratee`', () => {
    const actual = mapKeys({ a: { b: 'c' } }, 'b')
    expect(actual).toStrictEqual({ c: { b: 'c' } })
  })
})
