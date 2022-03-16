import { pickBy } from './pickBy.js'

describe('pickBy()', () => {
  it('should work with a predicate argument', () => {
    const object = { a: 1, b: 2, c: 3, d: 4 }
    const actual = pickBy(object, n => n === 1 || n === 3)
    expect(actual).toStrictEqual({ a: 1, c: 3 })
  })
})
