import { formatQuery, isPathWithin } from './route.js'

describe('formatQuery()', () => {
  it('formats objects and entries', () => {
    expect(formatQuery({ page: 2, order: 'title' })).toBe('page=2&order=title')
    expect(
      formatQuery([
        ['page', 2],
        ['order', 'title']
      ])
    ).toBe('page=2&order=title')
  })

  it('returns an empty string without a query', () => {
    expect(formatQuery(null)).toBe('')
    expect(formatQuery(undefined)).toBe('')
    expect(formatQuery({})).toBe('')
  })

  it('expands arrays into entries with the same key', () => {
    expect(formatQuery({ tag: ['poetry', 'essay'], page: 1 })).toBe(
      'tag=poetry&tag=essay&page=1'
    )
  })

  it('leaves out `null` and `undefined` values, but not in arrays', () => {
    expect(formatQuery({ page: null, order: undefined, size: 0 })).toBe(
      'size=0'
    )
    expect(formatQuery({ tag: ['poetry', null, undefined] })).toBe(
      'tag=poetry&tag=&tag='
    )
  })

  it('keeps the characters that the router leaves unencoded', () => {
    // As used by list filters, see `createFiltersPanel()`:
    expect(
      formatQuery({ filter: ['title:"contains","A, B"', 'year:1900,2000'] })
    ).toBe(
      'filter=title:%22contains%22,%22A,+B%22&filter=year:1900,2000'
    )
    expect(formatQuery({ path: '/books/1?a=b@c;$!()' })).toBe(
      'path=/books/1?a=b@c;$!()'
    )
  })

  it('encodes characters that would break the query', () => {
    expect(formatQuery({ q: 'a&b#c+d%' })).toBe('q=a%26b%23c%2Bd%25')
  })
})

describe('isPathWithin()', () => {
  it('matches the path itself and its sub-paths', () => {
    expect(isPathWithin('/books', '/books')).toBe(true)
    expect(isPathWithin('/books/1', '/books')).toBe(true)
    expect(isPathWithin('/books/1/chapters/2', '/books/1')).toBe(true)
  })

  it('compares whole path segments', () => {
    expect(isPathWithin('/books/12', '/books/1')).toBe(false)
    expect(isPathWithin('/books-archive', '/books')).toBe(false)
    expect(isPathWithin('/books', '/books/1')).toBe(false)
  })

  it('handles base paths with trailing slashes', () => {
    expect(isPathWithin('/books', '/')).toBe(true)
    expect(isPathWithin('/books/1', '/books/')).toBe(true)
    expect(isPathWithin('/books', '')).toBe(true)
  })
})
