import { HttpError } from './errors.ts'
import type { DitoContext, ListQuery } from './types.ts'

// Parses the list parameters of a request in the order they appear. Names
// are words, and properties are words joined by dots, as ORM packages expect.

const namePattern = /^\w+$/
const propertyPattern = /^\w+(\.\w+)*$/

export function parseListQuery(ctx: DitoContext): ListQuery {
  const query: ListQuery = { filters: [], order: [], range: null, fields: null }
  for (const [key, value] of ctx.url.searchParams) {
    const [, filter] = key.match(/^filter\[(.*)\]$/) ?? []
    if (filter !== undefined) {
      check(namePattern.test(filter), key, value)
      // A repeated filter gets the values as its arguments, in order, so that
      // empty values keep their positions. A filter with one empty value has
      // no arguments, as in `?filter[published]`.
      const entry = query.filters.find(({ name }) => name === filter)
      if (entry) {
        entry.args.push(value)
      } else {
        query.filters.push({ name: filter, args: value ? [value] : [] })
      }
    } else if (key === 'order') {
      const [property = '', direction = 'asc', ...rest] = value
        .trim()
        .split(/\s+/)
      check(
        propertyPattern.test(property) &&
        (direction === 'asc' || direction === 'desc') &&
        !rest.length,
        key,
        value
      )
      query.order.push({ property, direction: direction as 'asc' | 'desc' })
    } else if (key === 'range') {
      const [, start, end] = value.match(/^(\d+),(\d+)$/) ?? []
      check(start !== undefined && +end! >= +start, key, value)
      query.range = [+start!, +end!]
    } else if (key === 'fields') {
      const fields = value.split(',').map(field => field.trim())
      check(
        fields.every(field => propertyPattern.test(field)),
        key,
        value
      )
      query.fields = [...(query.fields ?? []), ...fields]
    }
  }
  return query
}

function check(valid: boolean, key: string, value: string) {
  if (!valid) invalid(key, value)
}

function invalid(key: string, value: string): never {
  throw new HttpError(400, { detail: `Invalid ${key} '${value}'` })
}
