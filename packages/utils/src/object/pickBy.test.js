import { pickBy } from './pickBy.js'

describe('pickBy()', () => {
  it('should work with a callback argument', () => {
    const object = { a: 1, b: 2, c: 3, d: 4 }
    const actual = pickBy(object, n => n === 1 || n === 3)
    expect(actual).toStrictEqual({ a: 1, c: 3 })
  })

  it('should support string property accessor for truthy values', () => {
    const users = {
      user1: { name: 'Alice', active: true },
      user2: { name: 'Bob', active: false },
      user3: { name: 'Charlie', active: true }
    }
    const actual = pickBy(users, 'active')
    expect(actual).toStrictEqual({
      user1: { name: 'Alice', active: true },
      user3: { name: 'Charlie', active: true }
    })
  })

  it('should filter by numeric property with string accessor', () => {
    const items = {
      a: { score: 0 },
      b: { score: 5 },
      c: { score: 10 }
    }
    const actual = pickBy(items, 'score')
    expect(actual).toStrictEqual({
      b: { score: 5 },
      c: { score: 10 }
    })
  })

  it('should filter by string property with string accessor', () => {
    const data = {
      a: { label: '' },
      b: { label: 'test' },
      c: { label: 'value' }
    }
    const actual = pickBy(data, 'label')
    expect(actual).toStrictEqual({
      b: { label: 'test' },
      c: { label: 'value' }
    })
  })
})
