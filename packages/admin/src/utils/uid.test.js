import { vi } from 'vitest'
import { reactive, toRaw } from 'vue'
import { getUid, cloneWithUids, getOriginal } from './uid.js'
import { isTemporaryId } from './data.js'

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

describe('cloneWithUids()', () => {
  const getItemId = item => item.id

  it('gives the copies the uids of their originals', () => {
    const chapter = { title: 'One' }
    const item = reactive({ title: 'Emma', chapters: [chapter] })
    const uid = getUid(chapter)
    const copy = cloneWithUids(item)
    expect(copy).toEqual(item)
    expect(copy.chapters[0]).not.toBe(chapter)
    expect(getUid(copy.chapters[0])).toBe(uid)
  })

  it('shares uids that the originals receive later', () => {
    const item = { id: 7, notes: [{ text: 'One' }] }
    const copy = cloneWithUids(item)
    expect(getUid(copy, getItemId)).toBe(7)
    const uid = getUid(cloneWithUids(copy).notes[0])
    expect(getUid(item.notes[0])).toBe(uid)
  })

  it('remembers the originals of the copies', () => {
    const item = reactive({ notes: [{ text: 'One' }] })
    const copy = reactive(cloneWithUids(item))
    expect(getOriginal(copy)).toBe(toRaw(item))
    expect(getOriginal(copy.notes[0])).toBe(toRaw(item.notes[0]))
    expect(getOriginal(item)).toBe(null)
  })
})
