import { getRelativeDataPath } from './data.js'

describe('getRelativeDataPath()', () => {
  it('returns the part of the data path inside the parent data path', () => {
    expect(getRelativeDataPath('chapters/0/title', 'chapters')).toBe(
      '0/title'
    )
    expect(getRelativeDataPath('chapters/0', '')).toBe('chapters/0')
  })

  it('returns an empty string for the same data paths', () => {
    expect(getRelativeDataPath('chapters', 'chapters')).toBe('')
    expect(getRelativeDataPath('', '')).toBe('')
  })

  it('returns `null` for data paths outside the parent data path', () => {
    expect(getRelativeDataPath('chapters', 'chapters/0')).toBe(null)
    expect(getRelativeDataPath('chaptersList/0', 'chapters')).toBe(null)
    expect(getRelativeDataPath('chapters', undefined)).toBe(null)
    expect(getRelativeDataPath(undefined, 'chapters')).toBe(null)
  })

  it('normalizes the data paths', () => {
    expect(getRelativeDataPath('chapters[0].title', 'chapters/')).toBe(
      '0/title'
    )
  })
})
