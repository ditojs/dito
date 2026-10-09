import fs from 'fs'
import os from 'os'
import path from 'path'
import { getDataUri } from './css.js'

const svg = (
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
  '<path d="M0 0h10v10H0z" fill="#000"/></svg>'
)

// The 8-byte PNG signature, which isn't valid UTF-8:
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('getDataUri()', () => {
  let directory

  const writeFile = (name, content) => {
    const file = path.join(directory, name)
    fs.writeFileSync(file, content)
    return file
  }

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dito-css-'))
  })

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true })
  })

  it('returns a compact, url-encoded data uri for svg files', () => {
    const uri = getDataUri(writeFile('bookmark.svg', svg))
    // Quotes become single quotes, brackets are encoded, colors shortened:
    expect(uri).toBe(
      `data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' ` +
      `viewBox='0 0 10 10'%3e%3cpath d='M0 0h10v10H0z' fill='black'/%3e` +
      '%3c/svg%3e'
    )
  })

  it('throws for missing files', () => {
    expect(() => getDataUri(path.join(directory, 'missing.svg'))).toThrow(
      /ENOENT/
    )
  })

  it('uses the mime type of the file extension for other files', () => {
    const uri = getDataUri(writeFile('notes.txt', 'abc'))
    expect(uri.startsWith('data:text/plain;base64,')).toBe(true)
  })

  it('base64-encodes the content of non-svg files', () => {
    const uri = getDataUri(writeFile('notes.txt', 'abc'))
    expect(uri).toBe(`data:text/plain;base64,${btoa('abc')}`)
  })

  it('preserves the binary content of image files', () => {
    const uri = getDataUri(writeFile('cover.png', pngBytes))
    expect(uri).toBe(`data:image/png;base64,${pngBytes.toString('base64')}`)
  })
})
