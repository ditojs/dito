import { parseDataPath } from './parseDataPath.js'

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

  it('should parse relative and absolute tokens', () => {
    expect(parseDataPath('/object/property1/../property2/../value'))
      .toStrictEqual(['object', 'property1', '..', 'property2', '..', 'value'])
    expect(parseDataPath('../object/value'))
      .toStrictEqual(['..', 'object', 'value'])
    expect(parseDataPath('./object/value'))
      .toStrictEqual(['.', 'object', 'value'])
    // This happens when concanating a data path with another absolute one, an
    // empty space will be interpreted as "start from scratch" when normalizing.
    expect(parseDataPath('//object/value'))
      .toStrictEqual(['', 'object', 'value'])
  })

  it('should handle white-space in JSON pointers', () => {
    expect(parseDataPath('/object/property name'))
      .toStrictEqual(['object', 'property name'])
  })

  it('should handle white-space in property access notation', () => {
    const expected = ['object', 'property name']
    expect(parseDataPath(`.object["property name"]`)).toStrictEqual(expected)
    expect(parseDataPath(`.object['property name']`)).toStrictEqual(expected)
  })

  it('should return a clone if argument is already an array', () => {
    const array = ['object', 'array', '1']
    const actual = parseDataPath(array)
    expect(actual).toStrictEqual(array)
    expect(actual).not.toBe(array)
  })

  it('should return undefined for values other than array / string', () => {
    expect(parseDataPath({})).toBe(undefined)
    expect(parseDataPath(false)).toBe(undefined)
    expect(parseDataPath(10)).toBe(undefined)
  })

  it('should parse an empty string to an empty array', () => {
    expect(parseDataPath('')).toStrictEqual([])
  })
})
