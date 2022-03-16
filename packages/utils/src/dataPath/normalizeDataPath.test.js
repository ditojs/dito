import { normalizeDataPath } from './normalizeDataPath.js'

describe('normalizeDataPath()', () => {
  it('should normalize JSON pointers', () => {
    expect(normalizeDataPath('/object/array/1/prop'))
      .toStrictEqual('object/array/1/prop')
  })

  it('should normalize property access notation', () => {
    const expected = 'object/array/1/prop'
    expect(normalizeDataPath('.object.array[1].prop')).toStrictEqual(expected)
    expect(normalizeDataPath('.object["array"][1].prop'))
      .toStrictEqual(expected)
    expect(normalizeDataPath(`['object']['array'][1]['prop']`))
      .toStrictEqual(expected)
  })

  it('should normalize relative tokens', () => {
    expect(normalizeDataPath('/object/property1/../value'))
      .toStrictEqual('object/value')
    expect(normalizeDataPath('/object/property1/../property2/../value'))
      .toStrictEqual('object/value')
    expect(normalizeDataPath('/object/property1/property2/../../value'))
      .toStrictEqual('object/value')
    expect(normalizeDataPath('/object/property1//object/value'))
      .toStrictEqual('object/value')
    expect(normalizeDataPath('/object1/object2/./object3/value'))
      .toStrictEqual('object1/object2/object3/value')
  })
})
