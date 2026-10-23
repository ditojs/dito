import { html, isHtml, asHtml } from './html.js'

describe('html()', () => {
  it('should escape interpolated values', () => {
    const name = '<img src=x onerror="alert(1)">'
    expect(html`<b>${name}</b>`.value).toBe(
      '<b>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</b>'
    )
  })

  it('should not escape interpolated html values again', () => {
    const name = html`<i>${'Tom & Jerry'}</i>`
    expect(html`<b>${name}</b>`.value).toBe('<b><i>Tom &amp; Jerry</i></b>')
  })

  it('should join arrays, escaping their items unless they are html', () => {
    expect(html`<p>${['<a>', html`<br>`, 'b']}</p>`.value).toBe(
      '<p>&lt;a&gt;<br>b</p>'
    )
  })

  it('should render null, undefined and false as empty', () => {
    expect(html`a${null}b${undefined}c${false}d`.value).toBe('abcd')
  })

  it('should render other values as strings', () => {
    expect(html`${0} ${1.5} ${true}`.value).toBe('0 1.5 true')
  })

  it('should convert to its value as a string', () => {
    expect(`${html`<b>${'&'}</b>`}`).toBe('<b>&amp;</b>')
  })

  it('should take trusted HTML as an array of strings', () => {
    expect(html(['<b>bold</b>']).value).toBe('<b>bold</b>')
  })
})

describe('isHtml()', () => {
  it('should recognize html values', () => {
    expect(isHtml(html`<b>bold</b>`)).toBe(true)
  })

  it('should recognize html values by their brand', () => {
    expect(isHtml({ [Symbol.for('dito.html')]: true, value: '' })).toBe(true)
  })

  it('should not recognize other values', () => {
    expect(isHtml('<b>bold</b>')).toBe(false)
    expect(isHtml({ html: '<b>bold</b>' })).toBe(false)
    expect(isHtml(null)).toBe(false)
    expect(isHtml(undefined)).toBe(false)
  })
})

describe('asHtml()', () => {
  it('should return the HTML of html values', () => {
    expect(asHtml(html`<b>${'Q & A'}</b>`)).toBe('<b>Q &amp; A</b>')
  })

  it('should escape other values as text', () => {
    expect(asHtml('<b>Q & A</b>')).toBe('&lt;b&gt;Q &amp; A&lt;/b&gt;')
    expect(asHtml(1.5)).toBe('1.5')
    expect(asHtml(null)).toBe('')
  })
})
