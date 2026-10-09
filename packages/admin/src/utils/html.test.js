import { getTextFromHtml } from './html.js'

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
