import { escapeHtml } from './escapeHtml.js'

describe('escapeHtml()', () => {
  it('should escape quotes, ampersands, and smaller/greater than signs', () => {
    expect(escapeHtml('<div id="me, myself & i"/>'))
      .toBe('&lt;div id=&quot;me, myself &amp; i&quot;/&gt;')
  })

  it('should return an empty string if nothing can be processed', () => {
    expect(escapeHtml()).toBe('')
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml('')).toBe('')
  })

  it('should handle falsy values correctly', () => {
    expect(escapeHtml(0)).toBe('0')
    expect(escapeHtml(false)).toBe('false')
  })
})
