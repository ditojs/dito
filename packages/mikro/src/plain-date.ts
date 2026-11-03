import { formatPlainDate, isDate, isString } from '@ditojs/utils'
import { DateType, p } from '@mikro-orm/core'

// A `date` column that holds the local day. MikroORM's `p.date()` sends a
// `Date` as a UTC time, which Postgres cuts to the UTC day, and does the same
// with a string with a time. `plainDate()` stores both as the day of the
// server's time zone, in `em.create()`, in writes and in queries. It reads as
// `YYYY-MM-DD`.
//
//   expiryDate: plainDate().nullable()

export class PlainDate extends DateType {
  override convertToDatabaseValue(value: unknown) {
    const hasTime = isString(value) && value.includes('T')
    const date = hasTime ? new Date(value) : value
    // Postgres refuses invalid values.
    return (
      isDate(date) && !isNaN(+date) ? formatPlainDate(date) : value
    ) as string
  }
}

export const plainDate = () => p.type(PlainDate)
