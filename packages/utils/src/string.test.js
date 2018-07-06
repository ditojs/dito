import {
  camelize, decamelize, hyphenate, underscore, capitalize, labelize, deindent
} from './string'

const strings = [
  'foo bar', 'Foo bar', 'foo Bar', 'Foo Bar', 'FOO BAR', 'FooBar', 'fooBar'
]

describe('camelize()', () => {
  describe.each([
    [undefined, 'fooBar'],
    [false, 'fooBar'],
    [true, 'FooBar']
  ])(
    'camelize(value, %o)',
    (pascalCase, expected) => {
      describe.each([
        ...strings,
        'foo-bar', 'foo_bar', '--foo-bar--', '__foo_bar__'
      ])(
        `camelize(%o, ${pascalCase})`,
        value => {
          it(`returns ${expected}`, () => {
            expect(camelize(value, pascalCase)).toBe(expected)
          })
        }
      )
    }
  )

  it('should return an empty string if nothing can be processed', () => {
    expect(camelize()).toBe('')
    expect(camelize(null)).toBe('')
    expect(camelize('')).toBe('')
  })
})

describe('decamelize()', () => {
  const expected = 'foo bar'
  describe.each(strings)(
    'decamelize(%o)',
    value => {
      it(`returns ${expected}`, () => {
        expect(decamelize(value)).toBe(expected)
      })
    }
  )

  it('should return an empty string if nothing can be processed', () => {
    expect(decamelize()).toBe('')
    expect(decamelize(null)).toBe('')
    expect(decamelize('')).toBe('')
  })
})

describe('hyphenate()', () => {
  const expected = 'foo-bar'
  describe.each(strings)(
    'hyphenate(%o)',
    value => {
      it(`returns ${expected}`, () => {
        expect(hyphenate(value)).toBe(expected)
      })
    }
  )
})

describe('underscore()', () => {
  const expected = 'foo_bar'
  describe.each(strings)(
    'underscore(%o)',
    value => {
      it(`returns ${expected}`, () => {
        expect(underscore(value)).toBe(expected)
      })
    }
  )
})

describe('capitalize()', () => {
  it('should capitalize hyphenated text', () => {
    expect(capitalize('some-hyphenated-text')).toBe('Some-Hyphenated-Text')
  })

  it('should capitalize underscored text', () => {
    expect(capitalize('some_underscored_text')).toBe('Some_Underscored_Text')
  })

  it('should capitalize a camel-cased text', () => {
    expect(capitalize('someCamelCasedText')).toBe('SomeCamelCasedText')
  })

  it('should capitalize normal text', () => {
    expect(capitalize('some normal text')).toBe('Some Normal Text')
  })

  it('should consider numbers as word-breaks', () => {
    expect(capitalize('one234five')).toBe('One234Five')
  })

  it('should support umlauts', () => {
    expect(capitalize('mäuse häuschen')).toBe('Mäuse Häuschen')
  })

  it('should return an empty string if nothing can be processed', () => {
    expect(capitalize()).toBe('')
    expect(capitalize(null)).toBe('')
    expect(capitalize('')).toBe('')
  })
})

describe('labelize()', () => {
  it('should labelize hyphenated text', () => {
    expect(labelize('some-hyphenated-text')).toBe('Some Hyphenated Text')
  })

  it('should labelize underscored text', () => {
    expect(labelize('some_underscored_text')).toBe('Some Underscored Text')
  })

  it('should labelize camel-cased text', () => {
    expect(labelize('SomeCamelCasedText')).toBe('Some Camel Cased Text')
  })

  it('should labelize normal text', () => {
    expect(labelize('some normal text')).toBe('Some Normal Text')
  })

  it('should split numbers and words', () => {
    expect(labelize('one2')).toBe('One 2')
  })

  it('should split words and numbers both sides', () => {
    expect(labelize('one2three')).toBe('One 2 Three')
  })

  it('should keep multiple numbers together', () => {
    expect(labelize('one234five')).toBe('One 234 Five')
  })

  it('should return an empty string if nothing can be processed', () => {
    expect(labelize()).toBe('')
    expect(labelize(null)).toBe('')
    expect(labelize('')).toBe('')
  })
})

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
