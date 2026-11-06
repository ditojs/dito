import { formatPlainDate, isDate, isString } from '@ditojs/utils'
import { DateType } from '@mikro-orm/core'

// MikroORM's own date type sends a `Date`, or a string with a time, as a UTC
// time, which Postgres cuts to the UTC day. Store the day of the server's time
// zone instead.
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
