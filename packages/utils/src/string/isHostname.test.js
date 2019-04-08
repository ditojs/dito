import { isHostname } from './isHostname'

describe('isHostname()', () => {
  it('should return true for absolute URLs starting with schemas', () => {
    expect(isHostname('lineto.com')).toBe(true)
    expect(isHostname('www.lineto.com')).toBe(true)
    expect(isHostname('lineto_com')).toBe(false)
    expect(isHostname('line-to.com')).toBe(true)
    expect(isHostname('line_to.com')).toBe(false)
  })
})
