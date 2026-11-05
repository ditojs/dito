import { asArray, isEmpty, isString } from '@ditojs/utils'
import { z } from 'zod'
import type { Filter } from './list.ts'

// Server filters for the admin's `text` and `date-range` list filters. The
// admin sends `filter=name:"text"`, or `filter=name:"operator","text"` with
// operators, and `filter=name:"from","to"` for date ranges.
// Without properties, a filter applies to the property of its name.

const operators = ['contains', 'equals', 'starts-with', 'ends-with'] as const

// Rows where one of `properties` holds the text, case-insensitively.
// `contains` is the default operator. An empty text skips the filter.
export function defineTextFilter(properties: string[] = []): Filter {
  return {
    schema: z.union([
      z.string(),
      z.tuple([z.enum(operators).or(z.literal('')), z.string()])
    ]),
    where(value: string | [string, string], c, name) {
      const [operator, text] = isString(value) ? ['', value] : value
      if (!text) return undefined
      const escaped = text.replace(/[\\%_]/g, '\\$&')
      const pattern =
        operator === 'equals'
          ? escaped
          : operator === 'starts-with'
            ? `${escaped}%`
            : operator === 'ends-with'
              ? `%${escaped}`
              : `%${escaped}%`
      return {
        $or: (properties.length ? properties : [name]).map(property => ({
          [property]: { $ilike: pattern }
        }))
      }
    }
  }
}

// Rows whose date lies between two ISO date-times, either of which may be
// empty.
export function defineDateRangeFilter(property?: string): Filter {
  const date = z.iso.datetime({ offset: true }).or(z.literal(''))
  return {
    schema: z.union([date, z.tuple([date]), z.tuple([date, date])]),
    where(value: string | string[], c, name) {
      const [from, to] = asArray(value)
      const range = {
        ...(from && { $gte: new Date(from) }),
        ...(to && { $lte: new Date(to) })
      }
      return isEmpty(range) ? undefined : { [property ?? name]: range }
    }
  }
}
