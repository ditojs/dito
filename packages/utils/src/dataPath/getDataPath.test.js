import { getDataPath } from './getDataPath'

describe('getDataPath()', () => {
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
    expect(getDataPath(data, 'object.array[1].prop')).toBe('expected')
  })

  it('should return data at a given JSON pointer path', () => {
    expect(getDataPath(data, '/object/array/1/prop')).toBe('expected')
  })

  it(`should return data at a given 'relative' JSON pointer path`, () => {
    expect(getDataPath(data, 'object/array/1/prop')).toBe('expected')
  })

  it('should throw an error with faulty paths', () => {
    expect(() => getDataPath(data, 'object/unknown/prop'))
      .toThrow('Invalid path: object/unknown/prop')
  })

  it('should throw an error with nullish objects', () => {
    expect(() => getDataPath(null, 'object'))
      .toThrow('Invalid path: object')
  })

  it('should support custom error handler', () => {
    const handleError = (object, part, index) => `${part}, ${index}: err`
    expect(getDataPath(data, 'object/unknown/prop', handleError))
      .toBe('unknown, 1: err')
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

    expect(getDataPath(data, 'object/array/*/prop')).toEqual(['one', 'two'])
    expect(getDataPath(data, 'object.array[*].prop')).toEqual(['one', 'two'])
  })
})
