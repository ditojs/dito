import { vi } from 'vitest'
import {
  getClipboardData,
  hasClipboardData,
  copyClipboardData,
  readClipboardData
} from './clipboard.js'

// Returns a promise with its `resolve()` function, to control the order in
// which reads of the clipboard resolve.
function createDeferred() {
  let resolve
  const promise = new Promise(res => {
    resolve = res
  })
  return { promise, resolve }
}

describe('clipboard', () => {
  beforeEach(async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    await copyClipboardData('reset', null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('copyClipboardData()', () => {
    it('only provides the data to schemas of the same name', async () => {
      await copyClipboardData('book', { title: 'Emma' })
      expect(getClipboardData('book')).toEqual({ title: 'Emma' })
      expect(hasClipboardData('book')).toBe(true)
      expect(getClipboardData('author')).toBe(null)
      expect(hasClipboardData('author')).toBe(false)
    })

    it('writes the data marked with its schema to the system', async () => {
      await copyClipboardData('book', { title: 'Emma' })
      expect(
        JSON.parse(navigator.clipboard.writeText.mock.lastCall[0])
      ).toEqual({ $schema: 'book', title: 'Emma' })
    })

    it('keeps the data when the system clipboard fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      navigator.clipboard.writeText.mockRejectedValue(new Error('Denied'))
      await copyClipboardData('book', { title: 'Emma' })
      expect(getClipboardData('book')).toEqual({ title: 'Emma' })
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('readClipboardData()', () => {
    it('reads the data from the system clipboard', async () => {
      vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue(
        JSON.stringify({ $schema: 'book', title: 'Dune' })
      )
      await readClipboardData()
      expect(getClipboardData('book')).toEqual({ title: 'Dune' })
    })

    it('keeps the copied data when the system clipboard is empty', async () => {
      await copyClipboardData('book', { title: 'Emma' })
      vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('')
      await readClipboardData()
      expect(getClipboardData('book')).toEqual({ title: 'Emma' })
    })

    it('throws and keeps the copied data for malformed data', async () => {
      await copyClipboardData('book', { title: 'Emma' })
      vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('{ title')
      await expect(readClipboardData()).rejects.toThrow(SyntaxError)
      expect(getClipboardData('book')).toEqual({ title: 'Emma' })
    })

    it('ignores reads that a copy overtook', async () => {
      const { promise, resolve } = createDeferred()
      vi.spyOn(navigator.clipboard, 'readText').mockReturnValue(promise)
      const read = readClipboardData()
      await copyClipboardData('book', { title: 'Emma' })
      resolve(JSON.stringify({ $schema: 'book', title: 'Dune' }))
      await read
      expect(getClipboardData('book')).toEqual({ title: 'Emma' })
    })

    it('ignores reads that another read overtook', async () => {
      const first = createDeferred()
      const second = createDeferred()
      vi.spyOn(navigator.clipboard, 'readText')
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
      const firstRead = readClipboardData()
      const secondRead = readClipboardData()
      second.resolve(JSON.stringify({ $schema: 'book', title: 'Dune' }))
      await secondRead
      first.resolve(JSON.stringify({ $schema: 'book', title: 'Emma' }))
      await firstRead
      expect(getClipboardData('book')).toEqual({ title: 'Dune' })
    })

    it('ignores older reads that resolve before newer ones', async () => {
      const first = createDeferred()
      const second = createDeferred()
      vi.spyOn(navigator.clipboard, 'readText')
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
      const firstRead = readClipboardData()
      const secondRead = readClipboardData()
      first.resolve(JSON.stringify({ $schema: 'book', title: 'Emma' }))
      await firstRead
      second.resolve(JSON.stringify({ $schema: 'book', title: 'Dune' }))
      await secondRead
      expect(getClipboardData('book')).toEqual({ title: 'Dune' })
    })
  })
})
