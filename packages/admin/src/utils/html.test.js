import { html } from '@ditojs/utils'
import { getHtml, getText, getTextFromHtml } from './html.js'

describe('getHtml()', () => {
  it('escapes text, also as `{ text }`', () => {
    expect(getHtml('Tom & <img src=x onerror="alert(1)">')).toBe(
      'Tom &amp; &lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    )
    expect(getHtml({ text: 'Q & A' })).toBe('Q &amp; A')
  })

  it('keeps HTML marked with `html`, also as `{ text }`', () => {
    expect(getHtml(html`<b>${'Q & A'}</b>`)).toBe('<b>Q &amp; A</b>')
    expect(getHtml({ text: html`<b>Q</b>`, prefix: '1.' })).toBe('<b>Q</b>')
  })

  it('keeps line breaks and returns null without content', () => {
    expect(getHtml('Hardcover\nPaperback')).toBe('Hardcover\nPaperback')
    expect(getHtml(null)).toBe(null)
  })
})

describe('getText()', () => {
  it('returns text as it is, and the text of `html`', () => {
    expect(getText('Q & <b>A</b>')).toBe('Q & <b>A</b>')
    expect(getText({ text: 'Q & A' })).toBe('Q & A')
    expect(getText(html`<b>Q</b> &amp; ${'<A>'}`)).toBe('Q & <A>')
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
