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
  it('should return an empty string without any strings', () => {
    expect(getCommonPrefix()).toBe('')
  })
  it('should return the whole string when given only one', () => {
    expect(getCommonPrefix('recipes')).toBe('recipes')
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
  it('should return 0 without any strings', () => {
    expect(getCommonOffset()).toBe(0)
  })
  it('should stop at the end of the shortest string', () => {
    expect(getCommonOffset('recipes', 'recipe', 'recipes')).toBe(6)
  })
})
