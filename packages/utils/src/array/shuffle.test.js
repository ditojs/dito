import { shuffle } from './shuffle.js'

describe('shuffle()', () => {
  const array = [1, 2, 3]

  it('should return a new array', () => {
    expect(shuffle(array)).not.toBe(array)
  })

  it(`should contain the same elements after a collection is shuffled and sorted again`, () => {
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
