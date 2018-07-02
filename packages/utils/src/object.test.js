import { equals, merge, groupBy, mapKeys, mapValues } from './object'

describe('equals()', () => {
  const symbol1 = Symbol('a')
  const symbol2 = Symbol('b')
  describe.each([
    [1, 1, true], [1, Object(1), true], [1, '1', false], [1, 2, false],
    [-0, -0, true], [0, 0, true], [0, Object(0), true],
    [Object(0), Object(0), true], [-0, 0, true], [0, '0', false],
    [0, null, false],

    [NaN, NaN, true], [NaN, Object(NaN), true],
    [Object(NaN), Object(NaN), true], [NaN, 'a', false], [NaN, Infinity, false],

    ['a', 'a', true], ['a', Object('a'), true],
    [Object('a'), Object('a'), true], ['a', 'b', false], ['a', ['a'], false],

    [true, true, true], [true, Object(true), true],
    [Object(true), Object(true), true], [true, 1, false], [true, 'a', false],
    [false, false, true], [false, Object(false), true],
    [Object(false), Object(false), true], [false, 0, false], [false, '', false],

    [symbol1, symbol1, true], [symbol1, Object(symbol1), true],
    [Object(symbol1), Object(symbol1), true], [symbol1, symbol2, false],

    [null, null, true], [null, undefined, false], [null, {}, false],
    [null, '', false], [undefined, undefined, true], [undefined, null, false],
    [undefined, '', false]
  ])(
    'equals(%o, %o) (should compare primitives)',
    (a, b, expected) => {
      it(`returns ${expected}`, () => {
        expect(equals(a, b)).toBe(expected)
      })
    }
  )

  it('should compare arrays', () => {
    let array1 = [true, null, 1, 'a', undefined]
    let array2 = [true, null, 1, 'a', undefined]

    expect(equals(array1, array2)).toBe(true)

    array1 = [[1, 2, 3], new Date(2012, 4, 23), /x/, { e: 1 }]
    array2 = [[1, 2, 3], new Date(2012, 4, 23), /x/, { e: 1 }]

    expect(equals(array1, array2)).toBe(true)

    array1 = [1]
    array1[2] = 3

    array2 = [1]
    array2[1] = undefined
    array2[2] = 3

    expect(equals(array1, array2)).toBe(true)

    array1 = [
      Object(1),
      false,
      Object('a'),
      /x/,
      new Date(2012, 4, 23),
      ['a', 'b', [Object('c')]],
      { a: 1 }
    ]
    array2 = [
      1,
      Object(false),
      'a',
      /x/,
      new Date(2012, 4, 23),
      ['a', Object('b'), ['c']],
      { a: 1 }
    ]

    expect(equals(array1, array2)).toBe(true)

    array1 = [1, 2, 3]
    array2 = [3, 2, 1]

    expect(equals(array1, array2)).toBe(false)

    array1 = [1, 2]
    array2 = [1, 2, 3]

    expect(equals(array1, array2)).toBe(false)
  })

  it(`should treat arrays with identical values but different non-index properties as equal`, () => {
    let array1 = [1, 2, 3]
    let array2 = [1, 2, 3]

    array1.every = array1.filter = array1.forEach =
    array1.indexOf = array1.lastIndexOf = array1.map =
    array1.some = array1.reduce = array1.reduceRight = null

    array2.concat = array2.join = array2.pop =
    array2.reverse = array2.shift = array2.slice =
    array2.sort = array2.splice = array2.unshift = null

    expect(equals(array1, array2)).toBe(true)

    array1 = [1, 2, 3]
    array1.a = 1

    array2 = [1, 2, 3]
    array2.b = 1

    expect(equals(array1, array2)).toBe(true)

    array1 = /c/.exec('abcde')
    array2 = ['c']

    expect(equals(array1, array2)).toBe(true)
  })

  it('should compare sparse arrays', () => {
    const array = Array(1)
    expect(equals(array, Array(1))).toBe(true)
    expect(equals(array, [undefined])).toBe(true)
    expect(equals(array, Array(2))).toBe(false)
  })

  it('should compare plain objects', () => {
    let object1 = { a: true, b: null, c: 1, d: 'a', e: undefined }
    let object2 = { a: true, b: null, c: 1, d: 'a', e: undefined }

    expect(equals(object1, object2)).toBe(true)

    object1 = { a: [1, 2, 3], b: new Date(2012, 4, 23), c: /x/, d: { e: 1 } }
    object2 = { a: [1, 2, 3], b: new Date(2012, 4, 23), c: /x/, d: { e: 1 } }

    expect(equals(object1, object2)).toBe(true)

    object1 = { a: 1, b: 2, c: 3 }
    object2 = { a: 3, b: 2, c: 1 }

    expect(equals(object1, object2)).toBe(false)

    object1 = { a: 1, b: 2, c: 3 }
    object2 = { d: 1, e: 2, f: 3 }

    expect(equals(object1, object2)).toBe(false)

    object1 = { a: 1, b: 2 }
    object2 = { a: 1, b: 2, c: 3 }

    expect(equals(object1, object2)).toBe(false)
  })

  it('should compare objects regardless of key order', () => {
    const object1 = { a: 1, b: 2, c: 3 }
    const object2 = { c: 3, a: 1, b: 2 }

    expect(equals(object1, object2)).toBe(true)
  })

  it('should compare nested objects', () => {
    function noop() {}
    const object1 = {
      a: [1, 2, 3],
      b: true,
      c: Object(1),
      d: 'a',
      e: {
        f: ['a', Object('b'), 'c'],
        g: Object(false),
        h: new Date(2012, 4, 23),
        i: noop,
        j: 'a'
      }
    }

    const object2 = {
      a: [1, Object(2), 3],
      b: Object(true),
      c: 1,
      d: Object('a'),
      e: {
        f: ['a', 'b', 'c'],
        g: false,
        h: new Date(2012, 4, 23),
        i: noop,
        j: 'a'
      }
    }

    expect(equals(object1, object2)).toBe(true)
  })

  it('should compare objects with shared property values', () => {
    const object1 = {
      a: [1, 2]
    }

    const object2 = {
      a: [1, 2],
      b: [1, 2]
    }

    object1.b = object1.a

    expect(equals(object1, object2)).toBe(true)
  })

  it('should avoid common type coercions', () => {
    expect(equals(true, Object(false))).toBe(false)
    expect(equals(Object(false), Object(0))).toBe(false)
    expect(equals(false, Object(''))).toBe(false)
    expect(equals(Object(36), Object('36'))).toBe(false)
    expect(equals(0, '')).toBe(false)
    expect(equals(1, true)).toBe(false)
    expect(equals(1337756400000, new Date(2012, 4, 23))).toBe(false)
    expect(equals('36', 36)).toBe(false)
    expect(equals(36, '36')).toBe(false)
  })

  it('should compare functions', () => {
    function a() { return 1 + 2 }
    function b() { return 1 + 2 }

    expect(equals(a, a)).toBe(true)
    expect(equals(a, b)).toBe(false)
  })
})

describe('merge()', () => {
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

  it('should merge onto non-plain `object` values', () => {
    class Foo {}

    const object = new Foo()
    const actual = merge(object, { a: 1 })

    expect(actual).toStrictEqual(object)
    expect(object.a).toEqual(1)
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

  it('should merge plain objects onto non-plain objects', () => {
    class Foo {}

    const object = { a: 1 }
    const actual1 = merge(new Foo(), object)

    expect(actual1).toBeInstanceOf(Foo)
    expect(actual1).toEqual(object)

    const actual2 = merge([new Foo()], [object])
    expect(actual2[0]).toBeInstanceOf(Foo)
    expect(actual2).toEqual([object])
  })

  it('should not overwrite existing values with `undefined` in objects', () => {
    const actual = merge({ a: 1 }, { a: undefined, b: undefined })
    expect(actual).toStrictEqual({ a: 1, b: undefined })
  })

  it('should not overwrite existing values with `undefined` in arrays', () => {
    const array1 = [1]
    array1[2] = 3
    const actual1 = merge([4, 5, 6], array1)
    const expected1 = [1, 5, 3]
    expect(actual1).toStrictEqual(expected1)

    const array2 = [1, undefined, 3]
    const actual2 = merge([4, 5, 6], array2)
    expect(actual2).toStrictEqual(expected1)
  })
})

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
