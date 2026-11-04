import { z } from 'zod'
import { asArray } from '@ditojs/utils'

// Zod schemas for the values of the query string, which arrive as strings,
// imported from `@ditojs/server/zod`. Numbers and dates reject the empty
// string. Each one can be `.optional()` or have a `.default()`.

export const q = {
  boolean: () =>
    z.stringbool({
      truthy: ['true', '1'],
      falsy: ['false', '0'],
      case: 'sensitive'
    }),
  number: () => z.string().trim().min(1).pipe(z.coerce.number<string>()),
  integer: () => z.string().trim().min(1).pipe(z.coerce.number<string>().int()),
  string: () => z.string(),
  date: () => z.string().trim().min(1).pipe(z.coerce.date<string>()),
  // Repeated keys, `?a=1&a=2`. A single value is an array of one item. `max`
  // limits the number of values.
  array: <T extends z.ZodType>(item: T, { max }: { max?: number } = {}) =>
    z.preprocess(
      value => (value === undefined ? value : asArray(value)),
      max === undefined ? z.array(item) : z.array(item).max(max)
    )
}
