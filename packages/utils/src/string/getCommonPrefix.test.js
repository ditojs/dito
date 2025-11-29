import { getCommonPrefix, getCommonOffset } from './getCommonPrefix.js'

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

describe('getCommonOffset()', () => {
  it('should return the longest common prefix', () => {
    expect(getCommonOffset('interstate', 'intersection')).toBe(6)
    expect(getCommonOffset('intersection', 'interstate')).toBe(6)
  })
  it('should compare case-sensitively', () => {
    expect(getCommonOffset('interstate', 'Intersection')).toBe(0)
    expect(getCommonOffset('InterState', 'Intersection')).toBe(5)
  })
})
