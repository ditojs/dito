import {
  Relation,
  BelongsToOneRelation,
  HasOneRelation,
  HasOneThroughRelation,
  HasManyRelation,
  ManyToManyRelation
} from 'objection'
import { isObject, isString, asArray, capitalize } from '@ditojs/utils'
import { RelationError } from '@/errors'

const relationLookup = {
  // one:
  belongsTo: BelongsToOneRelation,
  hasOne: HasOneRelation,
  hasOneThrough: HasOneThroughRelation,
  // many:
  hasMany: HasManyRelation,
  manyToMany: ManyToManyRelation
}

const relationClasses = {
  BelongsToOneRelation,
  HasOneRelation,
  HasOneThroughRelation,
  HasManyRelation,
  ManyToManyRelation
}

const throughRelationClasses = {
  ManyToManyRelation,
  HasOneThroughRelation
}

class ModelReference {
  constructor(reference, models, allowUnknown = false) {
    this.modelName = null
    this.modelClass = null
    this.propertyNames = []
    // Parse and validate model key references
    for (const ref of asArray(reference)) {
      const [modelName, propertyName] = ref?.split('.') || []
      const modelClass = models[modelName]
      if (!modelClass && !allowUnknown) {
        throw new RelationError(
          `Unknown model reference: ${ref}`)
      }
      if (!this.modelName) {
        this.modelName = modelName
        this.modelClass = modelClass
      } else if (this.modelName !== modelName) {
        throw new RelationError(
          `Composite keys need to be defined on the same table: ${ref}`)
      }
      this.propertyNames.push(propertyName)
    }
  }

  toArray() {
    return this.propertyNames.map(propName => `${this.modelName}.${propName}`)
  }

  toString() {
    return `[${this.toArray().join(', ')}]`
  }

  buildThrough(to) {
    // Auto-generate the `through` setting based on simple conventions:
    // - The camelized through table is called: `${fromName}${toName}`
    // - The `through.from` property is called:
    //   `${fromModelName)${capitalize(fromProp)}`
    // - The `through.to` property is called:
    //   `${toModelName)${capitalize(toProp)}`
    // NOTE: Due to the use of knexSnakeCaseMappers(), there is no need to
    // generate actual table-names here.
    const fromName = this.modelName
    const fromProperties = this.propertyNames
    const toName = to.modelName
    const toProperties = to.propertyNames
    if (fromProperties.length !== toProperties.length) {
      throw new RelationError(`Unable to create through join for ` +
        `composite keys from '${this}' to '${to}'`)
    }
    const through = { from: [], to: [] }
    for (let i = 0; i < fromProperties.length; i++) {
      const fromProperty = fromProperties[i]
      const toProperty = toProperties[i]
      if (fromProperty && toProperty) {
        const throughName = `${fromName}${toName}`
        const throughFrom = `${fromName}${capitalize(fromProperty)}`
        const throughTo = `${toName}${capitalize(toProperty)}`
        through.from.push(`${throughName}.${throughFrom}`)
        through.to.push(`${throughName}.${throughTo}`)
      } else {
        throw new RelationError(
          `Unable to create through join from '${this}' to '${to}'`)
      }
    }
    return through
  }
}

function convertRelation(schema, models) {
  let {
    relation,
    // Dito-style relation description:
    from, to, through, inverse, scope,
    // Objection.js-style relation description
    join, modify, filter,
    ...rest
  } = schema || {}
  const relationClass = relationLookup[relation] ||
    relationClasses[relation] || relation
  if (!Relation.isPrototypeOf(relationClass)) {
    throw new RelationError(`Unrecognized relation: ${relation}`)
  } else if (join && !isString(relation)) {
    // Original Objection.js-style relation, just pass through
    return schema
  } else {
    // Dito-style relation, e.g.:
    // {
    //   relation: 'hasMany',
    //   from: 'FromModel.primaryKeyPropertyName',
    //   to: 'ToModel.foreignKeyPropertyName',
    //   scope: 'latest'
    // }
    from = new ModelReference(from, models, false)
    to = new ModelReference(to, models, false)
    if (throughRelationClasses[relationClass.name]) {
      // Setting `through` to `true` is the same as providing an empty object
      // for it. It simply means: auto-generate the through settings.
      if (through === true) {
        through = {}
      }
      if (!through) {
        throw new RelationError('The relation needs a `through` definition ' +
          'or a `through: true` setting to auto-generate it')
      } else if (!through.from && !through.to) {
        // Auto-generate the through settings, see buildThrough():
        const built = inverse ? to.buildThrough(from) : from.buildThrough(to)
        through.from = built.from
        through.to = built.to
      } else if (through.from && through.to) {
        // `through.from` and `through.to` need special processing, where  they
        // can either be model references or table references, and if they
        // reference models, they should be converted to table references and
        // the model should be extracted automatically.
        const throughFrom = new ModelReference(through.from, models, true)
        const throughTo = new ModelReference(through.to, models, true)
        if (throughFrom.modelClass || throughTo.modelClass) {
          if (throughFrom.modelClass === throughTo.modelClass) {
            through.modelClass = throughTo.modelClass
            through.from = throughFrom.toArray()
            through.to = throughTo.toArray()
          } else {
            throw new RelationError('Both sides of the `through` definition ' +
              'need to be on the same join model')
          }
        } else {
          // Assume the references are to a join table, and use the settings
          // unmodified.
        }
      } else {
        throw new RelationError('The relation needs a `through.from` and ' +
          '`through.to` definition')
      }
    } else if (through) {
      throw new RelationError('Unsupported through join definition')
    }
    modify = scope || modify || filter
    if (isObject(modify)) {
      // Convert a find-filter object to a filter function, same as in the
      // handling of definition.scopes, see Model.js
      modify = query => query.find(modify)
    }
    return {
      relation: relationClass,
      modelClass: to.modelClass,
      join: {
        from: from.toArray(),
        to: to.toArray(),
        through
      },
      modify,
      ...rest
    }
  }
}

export function convertRelations(ownerModelClass, relations, models) {
  const converted = {}
  for (const [name, relation] of Object.entries(relations)) {
    try {
      converted[name] = convertRelation(relation, models)
    } catch (err) {
      throw new RelationError(
        `${ownerModelClass.name}.relations.${name}: ${(err.message || err)}`)
    }
  }
  return converted
}

/**
 * Adds json schema properties for each of the modelClass' relations.
 */
export function addRelationSchemas(modelClass, jsonSchema) {
  const { properties } = jsonSchema
  for (const relation of modelClass.getRelationArray()) {
    const $ref = relation.relatedModelClass.name
    properties[relation.name] = relation.isOneToOne()
      ? {
        oneOf: [
          { $ref },
          { type: 'null' }
        ]
      }
      : {
        type: 'array',
        items: { $ref }
      }
  }
  return jsonSchema
}
