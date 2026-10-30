import type { Context } from 'hono'
import { ProblemError } from './errors.ts'
import type { ListQuery } from './types.ts'

// Parses the list parameters of a request in the order they appear. Names
// are words, and properties are words joined by dots, as ORM packages expect.

const namePattern = /^\w+$/
const propertyPattern = /^\w+(\.\w+)*$/

export function parseListQuery(c: Context): ListQuery {
  const query: ListQuery = { filters: [], order: [], range: null, fields: null }
  for (const [key, value] of new URL(c.req.url).searchParams) {
    const [, filter] = key.match(/^filter\[(.*)\]$/) ?? []
    if (filter !== undefined) {
      check(namePattern.test(filter), key, value)
      query.filters.push({ name: filter, args: value ? [value] : [] })
    } else if (key === 'filter') {
      // Dito 6's form: the name and its arguments as a JSON list.
      const [, name, json] = value.match(/^(\w+):(.*)$/) ?? []
      check(name !== undefined, key, value)
      query.filters.push({ name: name!, args: parseArgs(json!, key, value) })
    } else if (key === 'scope') {
      check(namePattern.test(value), key, value)
      query.filters.push({ name: value, args: [] })
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

function parseArgs(json: string, key: string, value: string): unknown[] {
  try {
    return JSON.parse(`[${json}]`)
  } catch {
    return invalid(key, value)
  }
}

function check(valid: boolean, key: string, value: string) {
  if (!valid) invalid(key, value)
}

function invalid(key: string, value: string): never {
  throw new ProblemError({
    status: 400,
    detail: `Invalid ${key} '${value}'`
  })
}
