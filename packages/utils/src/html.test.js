import { escapeHtml, stripTags } from './html'

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
})

describe('stripTags()', () => {
  it('should remove html tags from strings', () => {
    expect(stripTags('<p><b>this</b> is a marked-up string</p>'))
      .toBe('this is a marked-up string')
  })

  it('should return an empty string if nothing can be processed', () => {
    expect(stripTags()).toBe('')
    expect(stripTags(null)).toBe('')
    expect(stripTags('')).toBe('')
  })
})
