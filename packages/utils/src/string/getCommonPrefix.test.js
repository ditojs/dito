import { getCommonPrefix } from './getCommonPrefix.js'

describe('getCommonPrefix()', () => {
  it('should return the longest common prefix', () => {
    expect(getCommonPrefix('interstate', 'intersection')).toBe('inters')
    expect(getCommonPrefix('intersection', 'interstate')).toBe('inters')
  })
  it('should compare case-sensitively', () => {
    expect(getCommonPrefix('interstate', 'Intersection')).toBe('')
    expect(getCommonPrefix('InterState', 'Intersection')).toBe('Inter')
  })
})
