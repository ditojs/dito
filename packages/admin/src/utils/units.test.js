import { formatFileSize, parseFileSize } from './units.js'

describe('formatFileSize()', () => {
  // Expected values match the previously used `filesize` package.
  it.each([
    [0, '0 B'],
    [1, '1 B'],
    [0.5, '1 B'],
    [999, '999 B'],
    [1000, '1 kB'],
    [1001, '1 kB'],
    [1234, '1.23 kB'],
    [1500, '1.5 kB'],
    [9999, '10 kB'],
    [123456, '123.46 kB'],
    [999999, '1 MB'],
    [1234567, '1.23 MB'],
    [1e9, '1 GB'],
    [1.5e12, '1.5 TB'],
    [2.5e15, '2.5 PB'],
    [1e18, '1 EB'],
    [1e21, '1 ZB'],
    [-1500, '-1.5 kB']
  ])('formats %o as %o', (size, expected) => {
    expect(formatFileSize(size)).toBe(expected)
  })

  it('supports base 2', () => {
    expect(formatFileSize(1024, { base: 2 })).toBe('1 KiB')
    expect(formatFileSize(1536, { base: 2 })).toBe('1.5 KiB')
    expect(formatFileSize(1048576, { base: 2 })).toBe('1 MiB')
    expect(formatFileSize(1073741824, { base: 2 })).toBe('1 GiB')
  })
})

describe('parseFileSize()', () => {
  it.each([
    ['1024', 1024],
    [1024, 1024],
    ['100 bytes', 100],
    ['100B', 100],
    ['1k', 1000],
    ['1 kB', 1000],
    ['1 KB', 1000],
    ['1kb', 1000],
    ['1.5 MB', 1.5e6],
    ['1,5M', 1.5e6],
    ['1T', 1e12],
    ['1KiB', 1024],
    ['1 Ki', 1024],
    ['1.5 MiB', 1.5 * 1024 ** 2],
    ['2 GiB', 2 * 1024 ** 3],
    ['8b', 1],
    ['8 bits', 1],
    ['1Kb', 125],
    ['1Mb', 125000]
  ])('parses %o as %o bytes', (input, expected) => {
    expect(parseFileSize(input)).toBe(expected)
  })

  it('supports base 2', () => {
    expect(parseFileSize('1 MB', { base: 2 })).toBe(1024 ** 2)
    expect(parseFileSize('1 MiB', { base: 2 })).toBe(1024 ** 2)
    expect(parseFileSize('1Kb', { base: 2 })).toBe(128)
  })

  it('throws on invalid input', () => {
    expect(() => parseFileSize('MB')).toThrow()
    expect(() => parseFileSize('10 XB')).toThrow()
    expect(() => parseFileSize('10 MB 5')).toThrow(
      `Can't interpret file size: 10 MB 5`
    )
  })
})
