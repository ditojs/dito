import { QueryError } from '@/errors'
import { isObject, isArray, isString, asArray, capitalize } from '@ditojs/utils'
import Registry from './Registry'
import QueryFilters from './QueryFilters'

const QueryHandlers = new Registry()
export default QueryHandlers

QueryHandlers.register({
  where(builder, key, value) {
    processPropertyRefs(builder, null, value)
  },

  eager(builder, key, value) {
    for (const eager of asArray(value)) {
      builder.mergeEager(eager)
    }
  },

  scope(builder, key, value) {
    for (const scope of asArray(value)) {
      builder.mergeScope(scope)
    }
  },

  range(builder, key, value) {
    if (value) {
      const [start, end] = isString(value) ? value.split(/\s*,s*/) : value
      if (isNaN(start) || isNaN(end) || end < start) {
        throw new QueryError(`Invalid range: [${start}, ${end}].`)
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
      for (const ref of builder.getPropertyRefs(value, { parseDir: true })) {
        const { dir = 'asc', relation } = ref
        const columnName = ref.fullColumnName(builder)
        let orderName = columnName
        if (relation) {
          if (!relation.isOneToOne()) {
            throw new QueryError(`Can only order by model's own properties ` +
              `and by one-to-one relations' properties.`)
          }
          // TODO: Is the use of an alias required here?
          orderName = `${relation.name}${capitalize(ref.propertyName)}`
          builder.select(`${columnName} as ${orderName}`)
        }
        builder.orderBy(columnName, dir).skipUndefined()
      }
    }
  },

  omit: applyPropertiesExpression,
  pick: applyPropertiesExpression
})

function processPropertyRefs(builder, key, value, parts) {
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
  // TODO: figure out and implement a better convention for handling
  // AND / OR queries in object notation.
  // TODO: Support / figure out object literal notation for null filters
  //    latest: builder => builder.whereNull('nextId')
  // -> Compare with LoopBack and others
  // TODO: Figure out and implement better parsing of string
  // "?where=..."" queries, including AND / OR.
  // e.g.
  // /api/dummies?where=firstName=Joe&where=lastName=Doe
  // /api/dummies?where=firstName=Joe|where=lastName=Doe
  // NOTE: The 2nd notation will end up as a string containing
  // "firstName=Joe|where=lastName=Doe", and will have to be further
  // parsed.
  if (isObject(value)) {
    for (const [subKey, subValue] of Object.entries(value)) {
      // NOTE: We need to clone `parts` for branching:
      processPropertyRefs(builder, subKey, subValue,
        parts ? [...parts, key] : [])
    }
  } else if (parts) {
    // Recursive call in object parsing
    const filterName = QueryFilters.has(key) && key
    if (!filterName) parts.push(key)
    const ref = `${parts.join('.')}${filterName ? `:${filterName}` : ''}`
    builder.parseQueryFilter(ref, value)
  } else if (isString(value)) {
    const [ref, val] = value.split('=')
    builder.parseQueryFilter(ref, val)
  } else if (isArray(value)) {
    for (const entry of value) {
      processPropertyRefs(builder, null, entry)
    }
  } else {
    throw new QueryError(`Unsupported 'where' query: '${value}'.`)
  }
}

function parsePropertiesExpression(value) {
  // Use a very simple expression parser that expands these expressions,
  // delegating the hard work to JSON.parse():
  //
  // "Model1[name,id,relation],Model2[name,id]" ->
  // {
  //   Model1: [name, id, relation],
  //   Model2: [name, id]
  // }
  const parse = expression => {
    const replaced = expression
      // Quote all words:
      .replace(/\b(\w+)\b/g, '"$1"')
      // Expand "[" to ":[":
      .replace(/"\[/g, '":[')
    return JSON.parse(`{${replaced}}`)
  }

  return isArray(value)
    ? value.map(parse).reduce(
      (combined, value) => Object.assign(combined, value),
      {})
    : isString(value) ? parse(value)
    : []
}

function applyPropertiesExpression(builder, key, value) {
  const parsed = parsePropertiesExpression(value)
  const { app } = builder.modelClass()
  for (const [modelName, properties] of Object.entries(parsed)) {
    const modelClass = app.models[modelName]
    if (modelClass) {
      builder[key](modelClass, properties)
    } else {
      throw new QueryError(
        `Invalid reference to model '${modelName}' in '${key}=${value}'.`)
    }
  }
}
