import { vi } from 'vitest'
import appState from '../appState.js'
import { mountForm } from '../test/mount.js'
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

    it('provides typed data to all schemas of the same type', async () => {
      await copyClipboardData('cover', { files: [] }, 'upload')
      expect(getClipboardData('cover', 'upload')).toEqual({ files: [] })
      expect(getClipboardData('scan', 'upload')).toEqual({ files: [] })
      expect(getClipboardData('cover')).toBe(null)
      expect(
        JSON.parse(navigator.clipboard.writeText.mock.lastCall[0])
      ).toEqual({ $name: 'cover', $type: 'upload', files: [] })
    })

    it('provides list data only to lists of the same name', async () => {
      await copyClipboardData('books', { items: [] }, 'list')
      expect(getClipboardData('books', 'list')).toEqual({ items: [] })
      expect(getClipboardData('authors', 'list')).toBe(null)
      expect(getClipboardData('books')).toBe(null)
      expect(getClipboardData('books', 'upload')).toBe(null)
    })

    it('never provides data without a name', async () => {
      await copyClipboardData(undefined, { title: 'Emma' })
      expect(getClipboardData(undefined)).toBe(null)
      expect(hasClipboardData(undefined)).toBe(false)
    })

    it('clears the data when copying `null`', async () => {
      await copyClipboardData('book', { title: 'Emma' })
      await copyClipboardData('book', null)
      expect(getClipboardData('book')).toBe(null)
      expect(hasClipboardData('book')).toBe(false)
      expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('null')
    })

    it('writes the data marked with its schema to the system', async () => {
      await copyClipboardData('book', { title: 'Emma' })
      expect(
        JSON.parse(navigator.clipboard.writeText.mock.lastCall[0])
      ).toEqual({ $name: 'book', title: 'Emma' })
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
        JSON.stringify({ $name: 'book', title: 'Dune' })
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
      resolve(JSON.stringify({ $name: 'book', title: 'Dune' }))
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
      second.resolve(JSON.stringify({ $name: 'book', title: 'Dune' }))
      await secondRead
      first.resolve(JSON.stringify({ $name: 'book', title: 'Emma' }))
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
      first.resolve(JSON.stringify({ $name: 'book', title: 'Emma' }))
      await firstRead
      second.resolve(JSON.stringify({ $name: 'book', title: 'Dune' }))
      await secondRead
      expect(getClipboardData('book')).toEqual({ title: 'Dune' })
    })
  })

  describe('watchClipboardData()', () => {
    const isChrome = appState.agent.chrome

    afterEach(() => {
      appState.agent.chrome = isChrome
    })

    it('reads the clipboard once for all clipboards', async () => {
      // Only Chrome reads the clipboard without asking:
      appState.agent.chrome = true
      const readText = vi
        .spyOn(navigator.clipboard, 'readText')
        .mockResolvedValue('')
      const { wrapper } = await mountForm({
        schema: {
          clipboard: true,
          fields: {
            books: {
              type: 'list',
              inlined: true,
              form: {
                type: 'form',
                clipboard: true,
                fields: { title: { type: 'text' } }
              }
            }
          }
        },
        data: { books: [{ title: 'Emma' }, { title: 'Dune' }] }
      })
      expect(wrapper.findAll('.dito-clipboard')).toHaveLength(3)
      expect(readText).toHaveBeenCalledTimes(1)
      // ...and again when it can change, with one listener each:
      window.dispatchEvent(new Event('focus'))
      expect(readText).toHaveBeenCalledTimes(2)
      document.dispatchEvent(new Event('copy'))
      expect(readText).toHaveBeenCalledTimes(3)
    })
  })
})
