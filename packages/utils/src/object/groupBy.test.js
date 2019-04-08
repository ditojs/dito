import { groupBy } from './groupBy'

describe('groupBy()', () => {
  const array = [6.1, 4.2, 6.3]

  it('should transform keys by `iteratee`', () => {
    const actual = groupBy(array, Math.floor)
    expect(actual).toStrictEqual({ 4: [4.2], 6: [6.1, 6.3] })
  })

  it('should work with property names for `iteratee`', () => {
    const actual = groupBy(['one', 'two', 'three'], 'length')
    expect(actual).toStrictEqual({ 3: ['one', 'two'], 5: ['three'] })
  })

  it('should work with a number for `iteratee`', () => {
    const array = [
      [1, 'a'],
      [2, 'a'],
      [2, 'b']
    ]
    expect(groupBy(array, 0)).toStrictEqual(
      { 1: [[1, 'a']], 2: [[2, 'a'], [2, 'b']] }
    )
    expect(groupBy(array, 1)).toStrictEqual(
      { a: [[1, 'a'], [2, 'a']], b: [[2, 'b']] }
    )
  })

  it('should work with an object for `collection`', () => {
    const actual = groupBy({ a: 6.1, b: 4.2, c: 6.3 }, Math.floor)
    expect(actual).toStrictEqual({ 4: [4.2], 6: [6.1, 6.3] })
  })
})
