import { getListWithMovedItem } from './list.js'

describe('getListWithMovedItem()', () => {
  const [a, b, c] = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
  const list = [a, b, c]

  it('moves the item by the delta in a copy of the list', () => {
    expect(getListWithMovedItem(list, a, 1)).toEqual([b, a, c])
    expect(getListWithMovedItem(list, c, -2)).toEqual([c, a, b])
    expect(list).toEqual([a, b, c])
  })

  it('returns `null` if the item cannot move that far', () => {
    expect(getListWithMovedItem(list, a, -1)).toBe(null)
    expect(getListWithMovedItem(list, c, 1)).toBe(null)
    expect(getListWithMovedItem(list, b, 0)).toBe(null)
  })

  it('returns `null` if the item is not in the list', () => {
    expect(getListWithMovedItem(list, { name: 'a' }, 1)).toBe(null)
  })
})
