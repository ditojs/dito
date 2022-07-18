import { merge } from './merge.js'

describe('merge()', () => {
  it('should merge nested objects', () => {
    const source1 = { a: { b: [] } }
    const source2 = { a: { c: [] } }
    const expected = { a: { b: [], c: [] } }
    expect(merge({}, source1, source2)).toStrictEqual(expected)
    expect(merge({}, source2, source1)).toStrictEqual(expected)
  })

  it('should override keys in target with different types', () => {
    const source1 = { a: { b: 1 } }
    const source2 = { a: { b: [] } }
    expect(merge({}, source1, source2)).toStrictEqual(source2)
    expect(merge({}, source2, source1)).toStrictEqual(source1)
  })

  it('should merge objects at the same indices inside arrays', () => {
    const source1 = [{ a: 1 }, { b: 2 }]
    const source2 = [{ c: 3 }, { d: 4 }]
    const expected = [{ a: 1, c: 3 }, { b: 2, d: 4 }]
    expect(merge([], source1, source2)).toStrictEqual(expected)
  })

  it('should merge `source` into `object`', () => {
    const names = {
      characters: [
        { name: 'barney' },
        { name: 'fred' }
      ]
    }

    const ages = {
      characters: [
        { age: 36 },
        { age: 40 }
      ]
    }

    const heights = {
      characters: [
        { height: '5\'4"' },
        { height: '5\'5"' }
      ]
    }

    const expected = {
      characters: [
        { name: 'barney', age: 36, height: '5\'4"' },
        { name: 'fred', age: 40, height: '5\'5"' }
      ]
    }

    expect(merge(names, ages, heights)).toEqual(expected)
  })

  it('should work with multiple arguments', () => {
    const expected = { a: 4 }
    const actual = merge({ a: 1 }, { a: 2 }, { a: 3 }, expected)

    expect(actual).toStrictEqual(expected)
  })

  it('should not augment source objects', () => {
    const source1 = { a: [{ a: 1 }] }
    const source2 = { a: [{ b: 2 }] }
    const actual1 = merge({}, source1, source2)

    expect(source1.a).toStrictEqual([{ a: 1 }])
    expect(source2.a).toStrictEqual([{ b: 2 }])
    expect(actual1.a).toStrictEqual([{ a: 1, b: 2 }])

    const source3 = { a: [[1, 2, 3]] }
    const source4 = { a: [[4, 5]] }
    const actual2 = merge({}, source3, source4)

    expect(source3.a).toStrictEqual([[1, 2, 3]])
    expect(source4.a).toStrictEqual([[4, 5]])
    expect(actual2.a).toStrictEqual([[4, 5, 3]])
  })

  it('should overwrite existing values with `undefined` in objects', () => {
    const actual = merge({ a: 1 }, { a: undefined, b: undefined })
    expect(actual).toStrictEqual({ a: undefined, b: undefined })
  })

  it('should overwrite existing values with `undefined` in arrays', () => {
    const array1 = [1]
    array1[2] = 3
    const actual1 = merge([4, 5, 6], array1)
    expect(actual1).toStrictEqual([1, 5, 3])

    const array2 = [1, undefined, 3]
    const actual2 = merge([4, 5, 6], array2)
    expect(actual2).toStrictEqual([1, undefined, 3])
  })

  it('should merge regexps', () => {
    const source1 = { a: /1/ }
    const source2 = { a: /2/ }
    const expected = { a: /2/ }
    expect(merge({}, source1, source2)).toStrictEqual(expected)
  })

  it('should merge dates', () => {
    const source1 = { a: new Date(2012, 5, 9) }
    const source2 = { a: new Date(2021, 5, 9) }
    const expected = { a: new Date(2021, 5, 9) }
    expect(merge({}, source1, source2)).toStrictEqual(expected)
  })

  it('should be fine with nested promises', async () => {
    const promise1 = (async () => 1)()
    const promise2 = (async () => 2)()
    const source1 = { nested: { promise1 } }
    const source2 = { nested: { promise2 } }
    const expected = { nested: { promise1, promise2 } }
    const result = merge({}, source1, source2)
    expect(result).toStrictEqual(expected)
    expect(await result.nested.promise1).toStrictEqual(1)
    expect(await result.nested.promise2).toStrictEqual(2)
  })
})
