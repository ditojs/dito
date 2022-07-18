import { mapKeys } from './mapKeys.js'

describe('mapKeys()', () => {
  const array = [1, 2]
  const object = { a: 1, b: 2 }

  it('should map keys in `object` to a new object', () => {
    const actual = mapKeys(object, (key, value) => String(value))
    expect(actual).toStrictEqual({ 1: 1, 2: 2 })
  })

  it('should treat arrays like objects', () => {
    const actual = mapKeys(array, (key, value) => String(value))
    expect(actual).toStrictEqual({ 1: 1, 2: 2 })
  })
})
