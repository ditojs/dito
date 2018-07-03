import { parseDataPath, getDataPath, setDataPath } from './dataPath'

describe('parseDataPath()', () => {
  it('should parse JSON pointers', () => {
    expect(parseDataPath('/object/array/1/prop'))
      .toStrictEqual(['object', 'array', '1', 'prop'])
  })

  it('should parse property access notation', () => {
    const expected = ['object', 'array', '1', 'prop']
    expect(parseDataPath('.object.array[1].prop')).toStrictEqual(expected)
    expect(parseDataPath(`.object["array"][1].prop`)).toStrictEqual(expected)
    expect(parseDataPath(`['object']['array'][1]['prop']`))
      .toStrictEqual(expected)
  })

  it(`should parse 'relative' JSON pointers`, () => {
    expect(parseDataPath('object/array/1/prop'))
      .toStrictEqual(['object', 'array', '1', 'prop'])
  })

  it(`should parse 'relative' property access notation`, () => {
    expect(parseDataPath('object.array[1].prop'))
      .toStrictEqual(['object', 'array', '1', 'prop'])
  })

  it('should handle white-space in JSON pointers', () => {
    expect(parseDataPath(`/object/property name`))
      .toStrictEqual(['object', 'property name'])
  })

  it('should handle white-space in property access notation', () => {
    const expected = ['object', 'property name']
    expect(parseDataPath(`.object["property name"]`)).toStrictEqual(expected)
    expect(parseDataPath(`.object['property name']`)).toStrictEqual(expected)
  })
})

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

  it(`should return data at a given path in property access notation`, () => {
    expect(getDataPath(data, 'object.array[1].prop')).toBe('expected')
  })

  it(`should return data at a given JSON pointer path`, () => {
    expect(getDataPath(data, '/object/array/1/prop')).toBe('expected')
  })

  it(`should return data at a given 'relative' JSON pointer path`, () => {
    expect(getDataPath(data, 'object/array/1/prop')).toBe('expected')
  })

  it(`should throw an error with faulty paths`, () => {
    expect(() => getDataPath(data, 'object/unknown/prop'))
      .toThrow('Invalid path: object/unknown/prop')
  })
})

describe('setDataPath()', () => {
  const data = {
    object: {
      array: [
        {}
      ]
    }
  }

  const add = { prop: 'new' }

  it(`should add data at a path to a given object`, () => {
    expect(() => setDataPath(data, 'object.array[0].added', add)).not.toThrow()
    expect(data.object.array[0].added).toStrictEqual(add)
  })

  it(`should add data at a path to a given array`, () => {
    expect(() => setDataPath(data, 'object.array[1]', add)).not.toThrow()
    expect(data.object.array[1]).toStrictEqual(add)
  })

  it(`should throw an error with faulty paths`, () => {
    expect(() => setDataPath(data, 'object/unknown/prop', add)).toThrow()
  })
})
