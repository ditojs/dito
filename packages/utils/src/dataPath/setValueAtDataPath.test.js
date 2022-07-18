import { setValueAtDataPath } from './setValueAtDataPath.js'

describe('setValueAtDataPath()', () => {
  const data = {
    object: {
      array: [
        {}
      ],
      number: 10
    }
  }

  const add = { prop: 'new' }

  it('should add data at a path to a given object', () => {
    expect(() => setValueAtDataPath(data, 'object.array[0].added', add))
      .not.toThrow()
    expect(data.object.array[0].added).toStrictEqual(add)
  })

  it('should add data at a path to a given array', () => {
    expect(() => setValueAtDataPath(data, 'object.array[1]', add)).not.toThrow()
    expect(data.object.array[1]).toStrictEqual(add)
  })

  it('should throw an error with faulty paths', () => {
    expect(() => setValueAtDataPath(data, 'object/unknown/prop', add)).toThrow()
  })

  it('should throw an error with invalid target', () => {
    expect(() => setValueAtDataPath(data, 'object/number/invalid', add))
      .toThrow('Invalid path: object/number/invalid')
  })
})
