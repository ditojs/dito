import { flatten, shuffle } from './array'

describe('flatten()', () => {
  it('should support flattening of nested arrays', () => {
    const array = [1, [2, [3, [4]], 5]]
    expect(flatten(array)).toStrictEqual([1, 2, 3, 4, 5])
    expect(flatten(array, 1)).toStrictEqual([1, 2, [3, [4]], 5])
    expect(flatten(array, 2)).toStrictEqual([1, 2, 3, [4], 5])
  })

  it('should work with empty arrays', () => {
    const array = [[], [[]], [[], [[[]]]]]

    expect(flatten(array)).toStrictEqual([])
    expect(flatten(array, 1)).toStrictEqual([[], [], [[[]]]])
    expect(flatten(array, 2)).toStrictEqual([[[]]])
  })

  it('should treat sparse arrays as dense', () => {
    const array = [[1, 2, 3], Array(3)]
    const expected = [1, 2, 3]
    expected.push(undefined, undefined, undefined)
    expect(flatten(array)).toStrictEqual(expected)
  })

  it('should return an empty array for non array-like objects', () => {
    expect(flatten({ 0: 'a' })).toStrictEqual([])
  })
})

describe('shuffle()', () => {
  const array = [1, 2, 3]

  it('should return a new array', () => {
    expect(shuffle(array)).not.toBe(array)
  })

  it('should contain the same elements after a collection is shuffled', () => {
    expect(shuffle(array).sort()).toStrictEqual(array)
  })

  it('should shuffle small collections', () => {
    const results = {}
    for (let i = 0; i < 1000; i++) {
      const res = shuffle([1, 2])
      results[res] = res
    }
    const sorted = Object.entries(results).sort().map(([, value]) => value)
    expect(sorted).toStrictEqual([[1, 2], [2, 1]])
  })
})
