import { vi } from 'vitest'
import { reactive } from 'vue'
import { getUid, transferUids } from './uid.js'
import { setTemporaryId, isTemporaryId } from './data.js'

describe('getUid()', () => {
  it('generates and remembers unique ids per object', () => {
    const first = {}
    const second = {}
    const id = getUid(first)
    expect(id).toMatch(/^uid-\d+$/)
    expect(getUid(first)).toBe(id)
    expect(getUid(second)).not.toBe(id)
  })

  it(`generates ids that aren't temporary ids`, () => {
    expect(isTemporaryId(getUid({}))).toBe(false)
  })

  it('returns the same id for reactive proxies and their raw objects', () => {
    const item = {}
    const id = getUid(reactive(item))
    expect(getUid(item)).toBe(id)
  })

  it('uses and remembers the ids provided by `getItemId()`', () => {
    const item = { id: 7 }
    const getItemId = vi.fn(item => `book-${item.id}`)
    expect(getUid(item, getItemId)).toBe('book-7')
    item.id = 8
    expect(getUid(item, getItemId)).toBe('book-7')
    expect(getItemId).toHaveBeenCalledOnce()
  })

  it('falls back to generated ids if `getItemId()` returns none', () => {
    expect(getUid({}, () => null)).toMatch(/^uid-\d+$/)
  })

  it('returns `undefined` for missing items', () => {
    expect(getUid(null)).toBe(undefined)
    expect(getUid(undefined)).toBe(undefined)
  })
})

describe('transferUids()', () => {
  const getItemId = item => item.id

  it('transfers generated uids to the objects at the same places', () => {
    const item = { title: 'Emma', chapters: [{ title: 'One' }] }
    const itemUid = getUid(item)
    const chapterUid = getUid(item.chapters[0])
    const savedItem = { id: 1, title: 'Emma', chapters: [{ id: 2 }] }
    transferUids({ items: [item] }, { items: [savedItem] })
    expect(getUid(savedItem, getItemId)).toBe(itemUid)
    expect(getUid(savedItem.chapters[0], getItemId)).toBe(chapterUid)
  })

  it('transfers temporary ids', () => {
    const item = {}
    setTemporaryId(item)
    const uid = getUid(item, getItemId)
    const savedItem = { id: 1 }
    transferUids([item], [savedItem])
    expect(getUid(savedItem, getItemId)).toBe(uid)
  })

  it(`doesn't transfer the ids of saved items`, () => {
    const item = { id: 1 }
    getUid(item, getItemId)
    const otherItem = { id: 2 }
    transferUids([item], [otherItem])
    expect(getUid(otherItem, getItemId)).toBe(2)
  })

  it(`doesn't replace the uids of objects that have one`, () => {
    const item = {}
    getUid(item)
    const otherItem = {}
    const otherUid = getUid(otherItem)
    transferUids([item], [otherItem])
    expect(getUid(otherItem)).toBe(otherUid)
  })
})
