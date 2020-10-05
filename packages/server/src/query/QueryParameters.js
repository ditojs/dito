import { ResponseError, QueryBuilderError } from '@/errors'
import { isString, asArray } from '@ditojs/utils'
import Registry from './Registry'

export const QueryParameters = new Registry()

QueryParameters.register({
  scope(builder, key, value) {
    // Use `applyScope()` instead of `withScope()`, so the scope applied here
    // can clear earlier `withScope()` statements before `execute()` is run.
    builder.applyScope(...asArray(value))
  },

  filter(builder, key, value) {
    try {
      for (const filter of asArray(value)) {
        const [, name, json] = filter.match(/^(\w+):(.*)$/)
        const args = asArray(JSON.parse(`[${json}]`))
        builder.applyFilter(name, ...args)
      }
    } catch (error) {
      throw error instanceof ResponseError
        ? error
        : new QueryBuilderError(
          `Invalid Query filter parameters: ${error.message}.`
        )
    }
  },

  range(builder, key, value) {
    if (value) {
      const [from, to] = isString(value) ? value.split(/\s*,s*/) : value
      const start = +from
      const end = +to
      if (isNaN(start) || isNaN(end) || end < start) {
        throw new QueryBuilderError(`Invalid range: [${start}, ${end}].`)
      }
      builder.range(start, end)
    }
  },

  limit(builder, key, value) {
    builder.limit(value)
  },

  offset(builder, key, value) {
    builder.offset(value)
  },

  order(builder, key, value) {
    if (value) {
      for (const entry of asArray(value)) {
        const [propertyName, direction] = entry.trim().split(/\s+/)
        if (direction && !['asc', 'desc'].includes(direction)) {
          throw new QueryBuilderError(
            `Invalid order direction: '${direction}'.`
          )
        }
        const tableRef = builder.tableRefFor(builder.modelClass())
        const columnName = `${tableRef}.${propertyName}`
        if (direction) {
          builder.orderBy(columnName, direction)
        } else {
          builder.orderBy(columnName)
        }
      }
    }
  }
})
