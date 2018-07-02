import { escapeHtml, stripTags } from './html'

describe('escapeHtml()', () => {
  it('should escape quotes, ampersands, and smaller/greater than signs', () => {
    expect(escapeHtml('<div id="me, myself & i"/>'))
      .toBe('&lt;div id=&quot;me, myself &amp; i&quot;/&gt;')
  })
})

describe('stripTags()', () => {
  it('should remove html tags from strings', () => {
    expect(stripTags('<p><b>this</b> is a marked-up string</p>'))
      .toBe('this is a marked-up string')
  })
})
