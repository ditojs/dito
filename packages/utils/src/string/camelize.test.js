import { camelize } from './camelize.js'

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
