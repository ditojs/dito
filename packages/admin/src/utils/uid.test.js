import { vi } from 'vitest'
import { reactive } from 'vue'
import { getUid } from './uid.js'

describe('getUid()', () => {
  it('generates and remembers unique ids per object', () => {
    const first = {}
    const second = {}
    const id = getUid(first)
    expect(id).toMatch(/^@\d+$/)
    expect(getUid(first)).toBe(id)
    expect(getUid(second)).not.toBe(id)
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
    expect(getUid({}, () => null)).toMatch(/^@\d+$/)
  })

  it('returns `undefined` for missing items', () => {
    expect(getUid(null)).toBe(undefined)
    expect(getUid(undefined)).toBe(undefined)
  })
})
