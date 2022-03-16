import { isString, asArray } from '@ditojs/utils'
import Registry from './Registry.js'
import { ResponseError, QueryBuilderError } from '../errors/index.js'

export const QueryParameters = new Registry()

QueryParameters.register({
  scope(query, key, value) {
    // Use `applyScope()` instead of `withScope()`, so the scope applied here
    // can clear earlier `withScope()` statements before `execute()` is run.
    query.applyScope(...asArray(value))
  },

  filter(query, key, value) {
    try {
      for (const filter of asArray(value)) {
        const [, name, json] = filter.match(/^(\w+):(.*)$/)
        const args = asArray(JSON.parse(`[${json}]`))
        query.applyFilter(name, ...args)
      }
    } catch (error) {
      throw error instanceof ResponseError
        ? error
        : new QueryBuilderError(
          `Invalid Query filter parameters: ${error.message}.`
        )
    }
  },

  range(query, key, value) {
    if (value) {
      const [from, to] = isString(value) ? value.split(/\s*,s*/) : value
      const start = +from
      const end = +to
      if (isNaN(start) || isNaN(end) || end < start) {
        throw new QueryBuilderError(`Invalid range: [${start}, ${end}].`)
      }
      query.range(start, end)
    }
  },

  limit(query, key, value) {
    query.limit(value)
  },

  offset(query, key, value) {
    query.offset(value)
  },

  order(query, key, value) {
    if (value) {
      for (const entry of asArray(value)) {
        const [propertyName, direction] = entry.trim().split(/\s+/)
        if (direction && !['asc', 'desc'].includes(direction)) {
          throw new QueryBuilderError(
            `Invalid order direction: '${direction}'.`
          )
        }
        const tableRef = query.tableRefFor(query.modelClass())
        const columnName = `${tableRef}.${propertyName}`
        if (direction) {
          query.orderBy(columnName, direction)
        } else {
          query.orderBy(columnName)
        }
      }
    }
  }
})
