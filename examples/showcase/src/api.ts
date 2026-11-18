import type { RequestMethod } from '@ditojs/admin'
import { books as initialBooks, type Book } from './data.js'

// An API in the browser in place of a Dito.js server. It answers the admin's
// requests from the books in memory, like the server's controllers: `range`
// paginates, `order` sorts, and `scope` and `filter` narrow the books down.
const user = { id: 1, username: 'showcase', name: 'Showcase' }
let lastId = 0
const books = initialBooks.map(book => addIds(structuredClone(book)))

export const request = (async ({ url, method = 'get', query, data }) => {
  const { pathname, searchParams } = new URL(url, location.origin)
  const [resource, id] = pathname.replace(/^\/api\//, '').split('/')
  const params = { ...Object.fromEntries(searchParams), ...query }
  const body = getBody(method, resource, id, params, data as Book)
  const response = new Response(JSON.stringify(body ?? null), {
    status: body ? 200 : 404,
    headers: { 'Content-Type': 'application/json' }
  })
  if (!response.ok) {
    throw Object.assign(new Error(`Unknown resource: '${url}'`), { response })
  }
  return Object.assign(response, { data: body })
}) as RequestMethod

function getBody(
  method: string,
  resource: string,
  id: string | undefined,
  params: Record<string, any>,
  data: Book
) {
  if (resource === 'session') {
    return { authenticated: true, user }
  } else if (resource === 'self') {
    return user
  } else if (resource === 'books') {
    if (!id) {
      return method === 'post'
        ? books[books.push(addIds(data)) - 1]
        : getBooks(params)
    }
    const index = books.findIndex(book => book.id === +id)
    if (index >= 0) {
      return method === 'get'
        ? books[index]
        : method === 'delete'
          ? books.splice(index, 1)[0]
          : Object.assign(books[index], addIds(data))
    }
  }
}

function getBooks({ scope, filter, order, range }: Record<string, any>) {
  const [search] = [filter ?? []]
    .flat()
    .filter(entry => entry.startsWith('search:'))
    .map(entry => JSON.parse(entry.slice(7)).toLowerCase())
  const [key, direction] = (order ?? 'title asc').split(' ')
  const results = books
    .filter(
      book => (
        (
          scope === 'available'
            ? book.available
            : scope === 'lent'
              ? !book.available
              : true
        ) && (
          !search ||
          `${book.title} ${book.author}`.toLowerCase().includes(search)
        )
      )
    )
    .sort(
      (a, b) => (
        String(a[key as keyof Book]).localeCompare(
          String(b[key as keyof Book]),
          undefined,
          { numeric: true }
        ) * (direction === 'desc' ? -1 : 1)
      )
    )
  if (range) {
    const [start, end] = range.split(',').map(Number)
    return { results: results.slice(start, end + 1), total: results.length }
  }
  return results
}

function addIds(book: Book) {
  book.id ??= ++lastId
  for (const chapter of book.chapters ?? []) {
    chapter.id ??= ++lastId
  }
  return book
}
