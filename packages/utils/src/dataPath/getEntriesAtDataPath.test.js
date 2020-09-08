import { getEntriesAtDataPath } from './getEntriesAtDataPath'

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
      .toBe('Error: unknown, 1')
  })

  it('should return wildcard matches', () => {
    const data = {
      object: {
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
      }
    }

    expect(getEntriesAtDataPath(data, 'object/array/*/name'))
      .toStrictEqual({
        'object/array/0/name': 'one',
        'object/array/1/name': 'two'
      })
    expect(getEntriesAtDataPath(data, 'object.array[*].name'))
      .toStrictEqual({
        'object/array/0/name': 'one',
        'object/array/1/name': 'two'
      })
    expect(getEntriesAtDataPath(data, 'object/array/*/array/*/name'))
      .toStrictEqual({
        'object/array/0/array/0/name': 'one.one',
        'object/array/0/array/1/name': 'one.two',
        'object/array/1/array/0/name': 'two.one',
        'object/array/1/array/1/name': 'two.two'
      })
  })
})
