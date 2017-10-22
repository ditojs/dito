import objection from 'objection'
import PropertyRef from './PropertyRef'
import { QueryError } from '@/errors'
import { isObject, isString, capitalize } from '@/utils'

// This code is based on objection-find, and simplified.
// Instead of a separate class, we extend objection.QueryBuilder to better
// integrate with Objection.js

export default class QueryBuilder extends objection.QueryBuilder {
  constructor(modelClass) {
    super(modelClass)
    this._allow = null
    this._propertyRefsCache = {}
  }

  find(params = {}) {
    // TODO: Add support for omit
    this._relationsToJoin = {}
    for (const [key, value] of Object.entries(params)) {
      const handler = handlers[key]
      if (handler) {
        handler(this, key, value)
      } else {
        this.parseFilter(key, value)
      }
    }
    // TODO: Is this really needed? Looks like it works without it also...
    for (const relation of Object.values(this._relationsToJoin)) {
      relation.join(this, { joinOperation: 'leftJoin' })
    }
    return this
  }

  allow(refs) {
    if (refs) {
      this._allow = this._allow || {}
      for (const { key } of this.getPropertyRefs(refs, { checkAllow: false })) {
        this._allow[key] = true
      }
    } else {
      this._allow = null
    }
    return this
  }

  getPropertyRefs(refs, { parseDir = false, checkAllow = true } = {}) {
    refs = isString(refs) ? refs.split(/\s*\|\s*/) : refs
    const cache = this._propertyRefsCache
    // Pass on _allow to make sure there are only allowed properties in the
    // query parameters.
    return refs.map(ref => cache[ref] ||
      (cache[ref] = new PropertyRef(ref, this.modelClass(), parseDir,
        checkAllow && this._allow)))
  }

  parseFilter(key, value) {
    const parts = key.split(/\s*:\s*/)
    const filter = parts.length === 1 ? filters.eq
      : parts.length === 2 ? filters[parts[1]]
      : null
    if (!filter) {
      throw new QueryError(
        `QueryBuilder: Invalid filter in "${key}=${value}"`)
    }
    const propertyRefs = this.getPropertyRefs(parts[0])
    for (const ref of propertyRefs) {
      const { relation } = ref
      if (relation && relation.isOneToOne()) {
        this._relationsToJoin[relation.name] = relation
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
      const [start, end] = isString(value) ? value.split(/\s*,s*/) : value
      if (isNaN(start) || isNaN(end) || end < start) {
        throw new QueryError(`QueryBuilder: Invalid range: [${start}, ${end}]`)
      }
      builder.range(start, end)
    }
  },

  order(builder, key, value) {
    if (value) {
      for (const ref of builder.getPropertyRefs(value, { parseDir: true })) {
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
  },

  where(builder, key, value) {
    // Recursively translate object based filters to string based ones for
    // standardized processing in PropertyRef.
    // So this...
    //   where: {
    //     firstName: { like: 'Jo%' },
    //     lastName: '%oe',
    //     messages: {
    //       text: { like: '% and %' },
    //       unread: true
    //     }
    //   }
    // ...becomes that:
    //   { key: 'firstName:like', value: 'Jo%' }
    //   { key: 'lastName', value: '%oe' }
    //   { key: 'messages.text:like', value: '% and %' }
    //   { key: 'messages.unread', value: true }
    function processPropertyRefs(key, value, parts) {
      if (isObject(value)) {
        for (const [subKey, subValue] of Object.entries(value)) {
          // NOTE: We need to clone `parts` for branching:
          processPropertyRefs(subKey, subValue, parts ? [...parts, key] : [])
        }
      } else if (parts) {
        const filter = key in filters && key
        if (!filter) parts.push(key)
        const ref = `${parts.join('.')}${filter ? `:${filter}` : ''}`
        builder.parseFilter(ref, value)
      }
    }

    processPropertyRefs(null, value)
  }
}

const filters = {
  in(builder, ref, value) {
    return where(builder, ref, null, value.split(','), 'whereIn')
  },

  notIn(builder, ref, value) {
    return where(builder, ref, null, value.split(','), 'whereNotIn')
  },

  between(builder, ref, value) {
    return where(builder, ref, null, value.split(','), 'whereBetween')
  },

  notBetween(builder, ref, value) {
    return where(builder, ref, null, value.split(','), 'whereNotBetween')
  },

  null(builder, ref) {
    return where(builder, ref, null, null, 'whereNull')
  },

  notNull(builder, ref) {
    return where(builder, ref, null, null, 'whereNotNull')
  },

  empty(builder, ref) {
    return where(builder, ref, '=', '')
  },

  notEmpty(builder, ref) {
    // https://stackoverflow.com/a/42723975/1163708
    return where(builder, ref, '>', '')
  }
}

// TODO: ?
// http://docs.sequelizejs.com/manual/tutorial/querying.html
// [Op.regexp]: '^[h|a|t]'    // REGEXP/~ '^[h|a|t]' (MySQL/PG only)
// [Op.notRegexp]: '^[h|a|t]' // NOT REGEXP/!~ '^[h|a|t]' (MySQL/PG only)
// [Op.iRegexp]: '^[h|a|t]'    // ~* '^[h|a|t]' (PG only)
// [Op.notIRegexp]: '^[h|a|t]' // !~* '^[h|a|t]' (PG only)
// [Op.like]: { [Op.any]: ['cat', 'hat']}
// LIKE ANY ARRAY['cat', 'hat'] - also works for iLike and notLike
// [Op.overlap]: [1, 2]       // && [1, 2] (PG array overlap operator)
// [Op.contains]: [1, 2]      // @> [1, 2] (PG array contains operator)
// [Op.contained]: [1, 2]     // <@ [1, 2] (PG array contained by operator)
// [Op.any]: [2,3]            // ANY ARRAY[2, 3]::INTEGER (PG only)

const operators = {
  eq: '=',
  ne: '!=',
  not: 'is not',
  lt: '<',
  lte: '<=',
  gt: '>',
  gte: '>=',
  between: 'between',
  notBetween: 'not between',
  like: 'like',
  noteLike: 'not like',
  iLike: 'ilike',
  notILike: 'not ilike'
}

for (const [key, operator] of Object.entries(operators)) {
  filters[key] = (builder, ref, value) => (
    where(builder, ref, operator, value)
  )
}

function where(builder, ref, operator, value, method = 'where') {
  const columnName = ref.fullColumnName(builder)
  return {
    method,
    args: operator ? [columnName, operator, value] : [columnName, value]
  }
}
