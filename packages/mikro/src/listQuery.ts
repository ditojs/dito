import type { Context } from 'hono'
import { HttpError } from '@ditojs/server'

// The parsed list parameters.
export interface ListQuery {
  // `filter=name:args` in order, with the arguments as JSON, such as
  // `filter=title:"contains","Emma"`. Filters read strings, and a filter with
  // several arguments gets an array of them, in order. A repeated name, such as
  // that of a scope and of the filter panel, narrows the list further.
  filter: { name: string; value: string | string[] }[]
  // `order=name desc`
  order: { property: string; direction: 'asc' | 'desc' }[]
  // `range=0,49`, inclusive. A list with a range responds with
  // `{ results, total }`.
  range: [number, number] | null
}

// Filters and properties are words joined by dots:
const propertyPattern = /^\w+(\.\w+)*$/

export function parseListQuery(c: Context): ListQuery {
  const query: ListQuery = {
    filter: [],
    order: [],
    range: null
  }
  for (const [key, value] of new URL(c.req.url).searchParams) {
    if (key === 'filter') {
      const [, name = '', json = ''] = value.match(/^(.*?):(.*)$/s) ?? []
      const args = parseArguments(json)
      checkParameter(propertyPattern.test(name) && !!args, key, value)
      query.filter.push({ name, value: toFilterValue(args!) })
    } else if (key === 'order') {
      const [property = '', direction = 'asc', ...rest] = value
        .trim()
        .split(/\s+/)
      checkParameter(
        propertyPattern.test(property) &&
        (direction === 'asc' || direction === 'desc') &&
        !rest.length,
        key,
        value
      )
      query.order.push({ property, direction: direction as 'asc' | 'desc' })
    } else if (key === 'range') {
      const [, start, end] = value.match(/^(\d+),(\d+)$/) ?? []
      // Larger numbers lose digits, and Postgres refuses them.
      checkParameter(
        start !== undefined &&
        Number.isSafeInteger(+end!) &&
        +end! >= +start,
        key,
        value
      )
      query.range = [+start!, +end!]
    }
  }
  return query
}

function parseArguments(json: string): unknown[] | null {
  try {
    return JSON.parse(`[${json}]`)
  } catch {
    return null
  }
}

// The value of a filter with `args`, in strings as schemas read them from URLs.
// An array flattens into the arguments, and `null` keeps its position as ''.
function toFilterValue(args: unknown[]): string | string[] {
  const values = args.flat().map(arg => (arg === null ? '' : `${arg}`))
  return values.length === 1 ? values[0]! : values
}

function checkParameter(isValid: boolean, key: string, value: string) {
  if (!isValid) {
    throw new HttpError(400, { message: `Invalid ${key} '${value}'` })
  }
}
