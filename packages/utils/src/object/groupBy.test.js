import { groupBy } from './groupBy.js'

describe('groupBy()', () => {
  const array = [6.1, 4.2, 6.3]

  it('should group entries by the result of `callback`', () => {
    const actual1 = groupBy(array, Math.floor)
    expect(actual1).toStrictEqual({ 4: [4.2], 6: [6.1, 6.3] })

    const actual2 = groupBy(['one', 'two', 'three'], value => value.length)
    expect(actual2).toStrictEqual({ 3: ['one', 'two'], 5: ['three'] })
  })

  it('should group by numbers and strings', () => {
    const array = [
      [1, 'a'],
      [2, 'a'],
      [2, 'b']
    ]
    expect(groupBy(array, value => value[0])).toStrictEqual(
      { 1: [[1, 'a']], 2: [[2, 'a'], [2, 'b']] }
    )
    expect(groupBy(array, value => value[1])).toStrictEqual(
      { a: [[1, 'a'], [2, 'a']], b: [[2, 'b']] }
    )
  })

  it('should work with an object for `collection`', () => {
    const actual = groupBy({ a: 6.1, b: 4.2, c: 6.3 }, Math.floor)
    expect(actual).toStrictEqual({ 4: [4.2], 6: [6.1, 6.3] })
  })
})
