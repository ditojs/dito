import { isHostname } from './isHostname.js'

describe('isHostname()', () => {
  it('should return true for hostnames', () => {
    expect(isHostname('example.com')).toBe(true)
    expect(isHostname('www.example.com')).toBe(true)
    expect(isHostname('example_com')).toBe(false)
    expect(isHostname('line-to.com')).toBe(true)
    expect(isHostname('line_to.com')).toBe(false)
    expect(isHostname('linéto.com')).toBe(false)
  })
})
