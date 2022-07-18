import { getEntriesAtDataPath } from './getEntriesAtDataPath.js'

describe('getEntriesAtDataPath()', () => {
  const data = {
    object: {
      array: [
        null,
        {
          prop: 'expected'
        }
      ]
    }
  }

  it('should return data at a given path in property access notation', () => {
    expect(getEntriesAtDataPath(data, 'object.array[1].prop')).toStrictEqual({
      'object/array/1/prop': 'expected'
    })
  })

  it('should return data at a given JSON pointer path', () => {
    expect(getEntriesAtDataPath(data, '/object/array/1/prop')).toStrictEqual({
      'object/array/1/prop': 'expected'
    })
  })

  it(`should return data at a given 'relative' JSON pointer path`, () => {
    expect(getEntriesAtDataPath(data, 'object/array/1/prop')).toStrictEqual({
      'object/array/1/prop': 'expected'
    })
  })

  it('should throw an error with faulty paths', () => {
    expect(() => getEntriesAtDataPath(data, 'object/unknown/prop'))
      .toThrow('Invalid path: object/unknown/prop')
  })

  it('should throw an error with nullish objects', () => {
    expect(() => getEntriesAtDataPath(null, 'object'))
      .toThrow('Invalid path: object')
  })

  it('should support custom error handler', () => {
    const handleError = (object, part, index) => `Error: ${part}, ${index}`
    expect(getEntriesAtDataPath(data, 'object/unknown/prop', handleError))
      .toStrictEqual({ 'object/unknown/prop': 'Error: unknown, 1' })
  })

  it('should handle non-existing paths with custom `handleError()`', () => {
    const handleError = () => undefined
    expect(getEntriesAtDataPath(data, 'object/unknown/prop', handleError))
      .toStrictEqual({})
  })

  it('should return wildcard matches', () => {
    const data = {
      object1: {
        array: [
          {
            name: 'one',
            array: [
              { name: 'one.one' },
              { name: 'one.two' }
            ]
          },
          {
            name: 'two',
            array: [
              { name: 'two.one' },
              { name: 'two.two' }
            ]
          }
        ]
      },
      object2: {
        object: {
          one: {
            name: 'one',
            object: {
              one: { name: 'one.one' },
              two: { name: 'one.two' }
            }
          },
          two: {
            name: 'two',
            object: {
              one: { name: 'two.one' },
              two: { name: 'two.two' }
            }
          }
        }
      },
      object3: {
        array: [
          {
            one: { name: 'one.one' },
            two: { name: 'one.two' }
          },
          {
            one: { name: 'two.one' },
            two: { name: 'two.two' }
          }
        ]
      }
    }

    expect(getEntriesAtDataPath(data, 'object1/array/*/name'))
      .toStrictEqual({
        'object1/array/0/name': 'one',
        'object1/array/1/name': 'two'
      })
    expect(getEntriesAtDataPath(data, 'object1.array[*].name'))
      .toStrictEqual({
        'object1/array/0/name': 'one',
        'object1/array/1/name': 'two'
      })
    expect(getEntriesAtDataPath(data, 'object1/array/*/array/*/name'))
      .toStrictEqual({
        'object1/array/0/array/0/name': 'one.one',
        'object1/array/0/array/1/name': 'one.two',
        'object1/array/1/array/0/name': 'two.one',
        'object1/array/1/array/1/name': 'two.two'
      })
    expect(getEntriesAtDataPath(data, 'object2/object/*/name'))
      .toStrictEqual({
        'object2/object/one/name': 'one',
        'object2/object/two/name': 'two'
      })
    expect(getEntriesAtDataPath(data, 'object2/object/*/object/*/name'))
      .toStrictEqual({
        'object2/object/one/object/one/name': 'one.one',
        'object2/object/one/object/two/name': 'one.two',
        'object2/object/two/object/one/name': 'two.one',
        'object2/object/two/object/two/name': 'two.two'
      })
    expect(getEntriesAtDataPath(data, 'object3/array/*/*/name'))
      .toStrictEqual({
        'object3/array/0/one/name': 'one.one',
        'object3/array/0/two/name': 'one.two',
        'object3/array/1/one/name': 'two.one',
        'object3/array/1/two/name': 'two.two'
      })
  })
})
