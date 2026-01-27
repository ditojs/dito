import { mapValues } from './mapValues.js'

describe('mapValues()', () => {
  const array = [1, 2]
  const object = { a: 1, b: 2 }

  it('should map values in `object` to a new object', () => {
    const actual = mapValues(object, String)
    expect(actual).toStrictEqual({ a: '1', b: '2' })
  })

  it('should treat arrays like objects', () => {
    const actual = mapValues(array, String)
    expect(actual).toStrictEqual({ 0: '1', 1: '2' })
  })

  it('should support string property accessor', () => {
    const users = {
      user1: { id: 1, name: 'Alice', email: 'alice@example.com' },
      user2: { id: 2, name: 'Bob', email: 'bob@example.com' }
    }
    const actual = mapValues(users, 'email')
    expect(actual).toStrictEqual({
      user1: 'alice@example.com',
      user2: 'bob@example.com'
    })
  })

  it('should extract nested properties with string accessor', () => {
    const data = {
      a: { value: 10 },
      b: { value: 20 },
      c: { value: 30 }
    }
    const actual = mapValues(data, 'value')
    expect(actual).toStrictEqual({ a: 10, b: 20, c: 30 })
  })
})
