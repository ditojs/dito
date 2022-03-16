import { getValueAtDataPath } from './getValueAtDataPath.js'

describe('getValueAtDataPath()', () => {
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
    expect(getValueAtDataPath(data, 'object.array[1].prop')).toBe('expected')
  })

  it('should return data at a given JSON pointer path', () => {
    expect(getValueAtDataPath(data, '/object/array/1/prop')).toBe('expected')
  })

  it(`should return data at a given 'relative' JSON pointer path`, () => {
    expect(getValueAtDataPath(data, 'object/array/1/prop')).toBe('expected')
  })

  it('should throw an error with faulty paths', () => {
    expect(() => getValueAtDataPath(data, 'object/unknown/prop'))
      .toThrow('Invalid path: object/unknown/prop')
  })

  it('should throw an error with nullish objects', () => {
    expect(() => getValueAtDataPath(null, 'object'))
      .toThrow('Invalid path: object')
  })

  it('should support custom error handler', () => {
    const handleError = (object, part, index) => `Error: ${part}, ${index}`
    expect(getValueAtDataPath(data, 'object/unknown/prop', handleError))
      .toBe('Error: unknown, 1')
  })

  it('should return wildcard matches', () => {
    const data = {
      object1: {
        array: [
          { name: 'one' },
          { name: 'two' }
        ]
      },
      object2: {
        object: {
          one: { name: 'one' },
          two: { name: 'two' }
        }
      }
    }

    expect(getValueAtDataPath(data, 'object1/array/*/name'))
      .toEqual(['one', 'two'])
    expect(getValueAtDataPath(data, 'object1.array[*].name'))
      .toEqual(['one', 'two'])
    expect(getValueAtDataPath(data, 'object2/object/*/name'))
      .toEqual(['one', 'two'])
    expect(getValueAtDataPath(data, 'object2.object[*].name'))
      .toEqual(['one', 'two'])
    expect(getValueAtDataPath(data, '*/*/*'))
      .toEqual([
        { name: 'one' },
        { name: 'two' },
        { name: 'one' },
        { name: 'two' }
      ])
    expect(getValueAtDataPath(data, '*/*/*/name'))
      .toEqual(['one', 'two', 'one', 'two'])
  })
})
