import { isHostname } from './isHostname.js'

describe('isHostname()', () => {
  it('should return true for hostnames', () => {
    expect(isHostname('lineto.com')).toBe(true)
    expect(isHostname('www.lineto.com')).toBe(true)
    expect(isHostname('lineto_com')).toBe(false)
    expect(isHostname('line-to.com')).toBe(true)
    expect(isHostname('line_to.com')).toBe(false)
    expect(isHostname('linéto.com')).toBe(false)
  })
})
