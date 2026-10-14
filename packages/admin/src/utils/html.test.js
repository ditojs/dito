import { getHtml, getText, getTextFromHtml } from './html.js'

describe('getHtml()', () => {
  it('escapes text, also as `{ text }`', () => {
    expect(getHtml('Tom & <b>Jerry</b>')).toBe(
      'Tom &amp; &lt;b&gt;Jerry&lt;/b&gt;'
    )
    expect(getHtml({ text: 'Q & A' })).toBe('Q &amp; A')
  })

  it('keeps HTML given as `{ html }`', () => {
    expect(getHtml({ html: '<b>Q &amp; A</b>' })).toBe('<b>Q &amp; A</b>')
  })

  it('keeps line breaks and returns null without content', () => {
    expect(getHtml('Hardcover\nPaperback')).toBe('Hardcover\nPaperback')
    expect(getHtml(null)).toBe(null)
  })
})

describe('getText()', () => {
  it('returns text as it is, and the text of `{ html }`', () => {
    expect(getText('Q & <b>A</b>')).toBe('Q & <b>A</b>')
    expect(getText({ text: 'Q & A' })).toBe('Q & A')
    expect(getText({ html: '<b>Q</b> &amp; A' })).toBe('Q & A')
  })
})

describe('getTextFromHtml()', () => {
  it('strips tags and unescapes entities', () => {
    expect(getTextFromHtml(`<b>Book</b> 'Tom &amp; Jerry &lt;b&gt;'`)).toBe(
      `Book 'Tom & Jerry <b>'`
    )
  })

  it('trims surrounding whitespace', () => {
    expect(getTextFromHtml('  <p>Recipe</p>\n')).toBe('Recipe')
  })
})
