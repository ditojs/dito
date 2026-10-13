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

  it('should return the root data for empty paths', () => {
    expect(getValueAtDataPath(data, '')).toBe(data)
  })

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

  it('should return shallow wildcard matches', () => {
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

    expect(getValueAtDataPath(data, '**/name'))
      .toEqual(['one', 'two', 'one', 'two'])
  })

  it('should return deep wildcard matches', () => {
    const data = {
      object: {
        object: {
          array: [
            { name: 'one' },
            { name: 'two' },
            {
              object: {
                one: { name: 'three' },
                two: { name: 'four' }
              },
              array: [
                { name: 'five' },
                { name: 'six' },
                {
                  object: {
                    one: { name: 'seven' },
                    two: { name: 'eight' }
                  }
                }
              ]
            }
          ]
        }
      }
    }

    expect(getValueAtDataPath(data, 'object/**/name'))
      .toEqual(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'])

    expect(getValueAtDataPath(data, 'object/**/object/one/name'))
      .toEqual(['three', 'seven'])

    expect(getValueAtDataPath(data, 'object/**/object/two/name'))
      .toEqual(['four', 'eight'])

    expect(getValueAtDataPath(data, 'object/**/array/0/name'))
      .toEqual(['one', 'five'])

    expect(getValueAtDataPath(data, 'object/**/array/1/name'))
      .toEqual(['two', 'six'])

    expect(getValueAtDataPath(data, 'object/**/object'))
      .toEqual([
        data.object.object,
        {
          one: { name: 'three' },
          two: { name: 'four' }
        },
        {
          one: { name: 'seven' },
          two: { name: 'eight' }
        }
      ])
  })

  it('should match zero or more levels with deep wildcards', () => {
    const data = { a: { c: 1, b: { c: 2 } } }
    expect(getValueAtDataPath(data, 'a/**/c')).toEqual([1, 2])
    expect(getValueAtDataPath(data, '**/c')).toEqual([1, 2])
    expect(getValueAtDataPath(data, 'a/**/b/c')).toEqual([2])
    // At the end of the path, only the values inside:
    expect(getValueAtDataPath(data, 'a/b/**')).toEqual([2])
    expect(getValueAtDataPath(data, 'a/**')).toEqual([1, { c: 2 }, 2])
  })

  it('should return values reached by several deep wildcards once', () => {
    // Both `x` match the first `x` of the path:
    const data = { x: { x: { y: 1 } } }
    expect(getValueAtDataPath(data, '**/x/**/y')).toEqual([1])
  })

  it('should return the values of deep wildcards depth-first', () => {
    const data = [{ a: 1 }, 2]
    expect(getValueAtDataPath(data, '**')).toEqual([{ a: 1 }, 1, 2])
  })
})
