import { setDataPathEntries } from './setDataPathEntries.js'

describe('setDataPathEntries()', () => {
  const data = {
    object: {
      array: [
        {}
      ],
      number: 10
    }
  }

  const add = { prop: 'new' }

  it('should add data at a path to a given object and array', () => {
    expect(() => setDataPathEntries(data, {
      'object.array[0].added': add,
      'object.array[1]': add
    }))
      .not.toThrow()
    expect(data.object.array[0].added).toStrictEqual(add)
    expect(data.object.array[1]).toStrictEqual(add)
  })

  it('should throw an error with faulty paths', () => {
    expect(() => setDataPathEntries(data, { 'object/unknown/prop': add }))
      .toThrow()
  })

  it('should throw an error with invalid target', () => {
    expect(() => setDataPathEntries(data, { 'object/number/invalid': add }))
      .toThrow('Invalid path: object/number/invalid')
  })
})
