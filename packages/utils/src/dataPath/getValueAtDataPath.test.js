import { getValueAtDataPath } from './getValueAtDataPath'

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
      object: {
        array: [
          { prop: 'one' },
          { prop: 'two' }
        ]
      }
    }

    expect(getValueAtDataPath(data, 'object/array/*/prop'))
      .toEqual(['one', 'two'])
    expect(getValueAtDataPath(data, 'object.array[*].prop'))
      .toEqual(['one', 'two'])
  })
})
