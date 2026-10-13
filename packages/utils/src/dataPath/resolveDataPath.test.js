import { resolveDataPath } from './resolveDataPath.js'

describe('resolveDataPath()', () => {
  it('should resolve paths relative to the data path', () => {
    expect(resolveDataPath('items/0', 'title')).toBe('items/0/title')
    expect(resolveDataPath('items/0', 'author.name')).toBe(
      'items/0/author/name'
    )
    expect(resolveDataPath('', 'title')).toBe('title')
  })

  it('should resolve relative tokens', () => {
    expect(resolveDataPath('items/0', '..')).toBe('items')
    expect(resolveDataPath('items/0', '../1/title/')).toBe('items/1/title')
    expect(resolveDataPath('items/0', './title')).toBe('items/0/title')
    expect(resolveDataPath('items/0', '../..')).toBe('')
  })

  it('should resolve paths with a leading slash from the root', () => {
    expect(resolveDataPath('items/0', '/title')).toBe('title')
    expect(resolveDataPath('items/0', '/items/../title')).toBe('title')
  })

  it('should keep wildcards', () => {
    expect(resolveDataPath('items/0', 'chapters/*/title')).toBe(
      'items/0/chapters/*/title'
    )
    expect(resolveDataPath('items/0', '../**')).toBe('items/**')
  })

  it('should throw for paths that lead above the root', () => {
    expect(() => resolveDataPath('items/0', '../../..')).toThrow(
      `Invalid data path: '../../..' leads above the root from 'items/0'.`
    )
    expect(() => resolveDataPath('items/0', '/..')).toThrow(
      `Invalid data path: '/..' leads above the root from 'items/0'.`
    )
  })
})
