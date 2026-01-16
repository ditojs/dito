import { decamelize, hyphenate, underscore } from './decamelize.js'

const strings = [
  'foo bar', 'Foo bar', 'foo Bar', 'Foo Bar', 'FOO BAR', 'FooBar', 'fooBar'
]

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

  it('should hyphenate single space between words', () => {
    expect(hyphenate('Foo Bar')).toBe('foo-bar')
  })

  it('should hyphenate multiple spaces', () => {
    expect(hyphenate('Foo  Bar')).toBe('foo-bar')
  })

  it('should trim leading whitespace', () => {
    expect(hyphenate('  Foo Bar')).toBe('foo-bar')
  })

  it('should trim trailing whitespace', () => {
    expect(hyphenate('Foo Bar  ')).toBe('foo-bar')
  })

  it('should hyphenate special characters correctly', () => {
    expect(hyphenate('Foo & Bar')).toBe('foo-&-bar')
  })
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

  it('should underscore multiple spaces', () => {
    expect(underscore('Foo  Bar')).toBe('foo_bar')
  })

  it('should trim leading whitespace', () => {
    expect(underscore('  Foo Bar')).toBe('foo_bar')
  })

  it('should trim trailing whitespace', () => {
    expect(underscore('Foo Bar  ')).toBe('foo_bar')
  })

  it('should underscore special characters correctly', () => {
    expect(underscore('Foo & Bar')).toBe('foo_&_bar')
  })
})
