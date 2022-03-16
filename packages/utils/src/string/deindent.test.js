import { deindent } from './deindent.js'

describe('deindent()', () => {
  it('should deindent indented multi-line strings', () => {
    expect(
      deindent`
        some
          indented
            text`
    ).toBe(
`some
  indented
    text`
    )
  })

  it('should preserve the last line-break', () => {
    expect(
      deindent`
        some
          indented
            text
      `
    ).toBe(
`some
  indented
    text
`
    )
  })

  it('should only swallow the first line-break, not those following', () => {
    expect(
      deindent`


        some
          indented
            text
      `
    ).toBe(
`

some
  indented
    text
`
    )
  })

  it('should not swallow the empty line-breaks at the end', () => {
    expect(
      deindent`
        some
          indented
            text


      `
    ).toBe(
`some
  indented
    text


`
    )
  })

  it('should handle multi-line strings without first or last line', () => {
    expect(
      deindent`some
  indented
    text
some
  indented
    text`
    ).toBe(
`some
  indented
    text
some
  indented
    text`
    )
  })

  it('should handle multi-line strings without first or last line', () => {
    expect(
      deindent`  some
    indented
      text`
    ).toBe(
`some
  indented
    text`
    )
  })

  it('should correctly indent nested single-line string values', () => {
    const singleLineText = 'single-line text'
    expect(
      deindent`
        some
          indented
            ${singleLineText}
      `
    ).toBe(
`some
  indented
    single-line text
`
    )
  })

  it('should correctly indent unnested multi-line string values', () => {
    const multiLineText = 'multi-\nline\ntext'
    expect(
      deindent`
some
indented
${multiLineText}
`
    ).toBe(
`some
indented
multi-
line
text
`
    )
  })

  it('should correctly indent nested multi-line string values', () => {
    const multiLineText = 'multi-\nline\ntext'
    expect(
      deindent`
        some
          indented
            ${multiLineText}
      `
    ).toBe(
`some
  indented
    multi-
    line
    text
`
    )
  })

  it('should maintain the indent of prefixed multi-line string values', () => {
    const multiLineText = 'multi-\nline\ntext'
    expect(
      deindent`
        some
          indented
            content: ${multiLineText}
      `
    ).toBe(
`some
  indented
    content: multi-
    line
    text
`
    )
  })

  it('should not deindent if the first line starts with text', () => {
    expect(
      deindent`some
        indented
          text`
    ).toBe(
`some
        indented
          text`
    )
  })
})
