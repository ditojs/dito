import { parseFileSize } from './units.js'

describe('parseFileSize()', () => {
  it.each([
    ['1024', 1024],
    [1024, 1024],
    ['100 bytes', 100],
    ['100B', 100],
    ['1k', 1024],
    ['1 KB', 1024],
    ['1kb', 1024],
    ['1KiB', 1024],
    ['1.5 MB', 1.5 * 1024 ** 2],
    ['1,5M', 1.5 * 1024 ** 2],
    ['2 GiB', 2 * 1024 ** 3],
    ['1T', 1024 ** 4],
    ['8b', 1],
    ['8 bits', 1],
    ['1Kb', 128],
    ['1Mb', 131072]
  ])('parses %o as %o bytes', (input, expected) => {
    expect(parseFileSize(input)).toBe(expected)
  })

  it('supports base 10', () => {
    expect(parseFileSize('1 MB', { base: 10 })).toBe(1e6)
    expect(parseFileSize('1Kb', { base: 10 })).toBe(125)
  })

  it('throws on invalid input', () => {
    expect(() => parseFileSize('MB')).toThrow()
    expect(() => parseFileSize('10 XB')).toThrow()
  })
})
