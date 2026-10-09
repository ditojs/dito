import { formatQuery, replaceRoute } from './route.js'

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

describe('replaceRoute()', () => {
  beforeEach(() => {
    window.happyDOM.setURL('http://localhost/books?page=2#list')
    history.replaceState({ position: 1 }, null)
  })

  it('replaces the query and keeps the path and hash', () => {
    replaceRoute({ query: { page: 3, order: 'title' } })
    expect(location.href).toBe(
      'http://localhost/books?page=3&order=title#list'
    )
  })

  it('replaces the path and hash and keeps the query', () => {
    replaceRoute({ path: '/authors', hash: '#top' })
    expect(location.href).toBe('http://localhost/authors?page=2#top')
  })

  it('preserves the history state', () => {
    replaceRoute({ query: { page: 4 } })
    expect(history.state).toEqual({ position: 1 })
  })
})
