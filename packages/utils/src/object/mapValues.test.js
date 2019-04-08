import { mapValues } from './mapValues'

describe('mapValues()', () => {
  const array = [1, 2]
  const object = { a: 1, b: 2 }

  it('should map values in `object` to a new object', () => {
    const actual = mapValues(object, String)
    expect(actual).toStrictEqual({ a: '1', b: '2' })
  })

  it('should treat arrays like objects', () => {
    const actual = mapValues(array, String)
    expect(actual).toStrictEqual({ 0: '1', 1: '2' })
  })

  it('should work with property names for `iteratee`', () => {
    const actual = mapValues({ a: { b: 2 } }, 'b')
    expect(actual).toStrictEqual({ a: 2 })
  })
})
