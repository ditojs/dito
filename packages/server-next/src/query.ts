import { z } from 'zod'

// Schemas for values of the query string, which arrive as strings. Numbers and
// dates reject the empty string. Each one can be `.optional()` or have a
// `.default()`.

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
  date: () => z.string().trim().min(1).pipe(z.coerce.date<string>())
}
