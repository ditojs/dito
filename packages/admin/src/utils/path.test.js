import { resolvePath } from './path.js'

describe('resolvePath()', () => {
  it('resolves `..` and `.` segments', () => {
    expect(resolvePath('/books/1/../2')).toBe('/books/2')
    expect(resolvePath('/books/./1')).toBe('/books/1')
    expect(resolvePath('/books/1/chapters/../../3')).toBe('/books/3')
  })

  it('does not go beyond the root', () => {
    expect(resolvePath('/books/../../authors')).toBe('/authors')
  })

  it('keeps paths without relative segments', () => {
    expect(resolvePath('/books/1')).toBe('/books/1')
    expect(resolvePath('/books/')).toBe('/books/')
  })
})
