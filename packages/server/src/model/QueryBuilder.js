import objection from 'objection'
import PropertyRef from './PropertyRef'
import QueryError from './QueryError'
import { isString, capitalize } from '@/utils'

// This code is based on objection-find, and simplified.
// Instead of a separate class, we extend objection.QueryBuilder to better
// integrate with Objection.js

// TODO: support more JS-like params for `where` and `range`, e.g:
// const test = {
//   eager: '[pets, children.[pets, children]]',
//   where: {
//     text: {
//       like: '%alias%'
//     }
//   },
//   range: [10, 20],
//   order: 'firstName ASC'
// }

export default class QueryBuilder extends objection.QueryBuilder {
  constructor(modelClass) {
    super(modelClass)
    this._allow = null
    this._propertyRefsCache = {}
  }

  find(params) {
    // TODO: omit
    const relationsToJoin = {}
    for (const [key, value] of Object.entries(params)) {
      const handler = handlers[key]
      if (handler) {
        handler(this, key, value)
      } else {
        const parts = key.split(/\s*:\s*/)
        let filter
        if (parts.length === 1) {
          filter = filters.eq
        } else if (parts.length === 2) {
          filter = filters[parts[1]]
        } else {
          throw new QueryError(
            `QueryBuilder: invalid query parameter "${key}=${value}"`)
        }
        if (!filter) {
          throw new QueryError(
            `QueryBuilder: invalid filter in "${key}=${value}"`)
        }
        const propertyRefs = this.getPropertyRefs(parts[0])
        for (const ref of propertyRefs) {
          // Check that we only have allowed property references in the query
          // parameters.
          if (this._allow && !this._allow[ref.key]) {
            throw new QueryError(
              `QueryBuilder: Property reference "${ref.key}" not allowed`)
          }
          const { relation } = ref
          if (relation && relation.isOneToOne()) {
            relationsToJoin[relation.name] = relation
          }
        }
        if (propertyRefs.length === 1) {
          propertyRefs[0].applyFilter(this, this, filter, value)
        } else {
          // If there are multiple property refs, they are combined with an `OR`
          // operator.
          this.where(builder => {
            for (const ref of propertyRefs) {
              ref.applyFilter(this, builder, filter, value, 'or')
            }
          })
        }
      }
    }
    // TODO: Is this really needed? Looks like it works without it also...
    for (const relation of Object.values(relationsToJoin)) {
      relation.join(this, { joinOperation: 'leftJoin' })
    }
    return this
  }

  allow(refs) {
    if (refs) {
      this._allow = this._allow || {}
      for (const { key } of this.getPropertyRefs(refs)) {
        this._allow[key] = true
      }
    } else {
      this._allow = null
    }
    return this
  }

  getPropertyRefs(refs, parseDir = false) {
    refs = isString(refs) ? refs.split(/\s*\|\s*/) : refs
    const cache = this._propertyRefsCache
    return refs.map(ref => cache[ref] ||
      (cache[ref] = new PropertyRef(ref, this.modelClass(), parseDir)))
  }

  static registerHandler(key, handler) {
    handlers[key] = handler
  }

  static registerFilter(key, handler) {
    filters[key] = handler
  }
}

const handlers = {
  eager(builder, key, value) {
    if (value) {
      builder.eager(value)
    }
  },

  range(builder, key, value) {
    if (value) {
      const [start, end] = value.split(/\s*,s*/)
      if (isNaN(start) || isNaN(end) || end < start) {
        throw new QueryError(`Invalid range [${start}, ${end}]`)
      }
      builder.range(start, end)
    }
  },

  order(builder, key, value) {
    if (value) {
      for (const ref of builder.getPropertyRefs(value, true)) {
        const { dir = 'asc', relation } = ref
        const columnName = ref.fullColumnName(builder)
        if (relation) {
          if (!relation.isOneToOne()) {
            throw new QueryError(
              `QueryBuilder: Can only order by model's own properties ` +
              `and by one-to-one relations' properties`)
          }
          // TODO: Is alias required here?
          const alias = `${relation.name}${capitalize(ref.propertyName)}`
          builder.select(`${columnName} as ${alias}`)
          builder.orderBy(alias, dir)
        } else {
          builder.orderBy(columnName, dir).skipUndefined()
        }
      }
    }
  }
}

const filters = {
  in(builder, propertyRef, value) {
    return {
      method: 'whereIn',
      args: [propertyRef.fullColumnName(builder), value.split(',')]
    }
  },

  null(builder, propertyRef) {
    return where(builder, propertyRef, 'is', null)
  },

  notNull(builder, propertyRef) {
    return where(builder, propertyRef, 'is not', null)
  }
}

const operators = {
  eq: '=',
  lt: '<',
  lte: '<=',
  gt: '>',
  gte: '>=',
  like: 'like',
  ilike: 'ilike'
}

for (const [key, operator] of Object.entries(operators)) {
  filters[key] = (builder, propertyRef, value) => (
    where(builder, propertyRef, operator, value)
  )
}

function where(builder, propertyRef, operator, value) {
  return {
    method: 'where',
    args: [propertyRef.fullColumnName(builder), operator, value]
  }
}
