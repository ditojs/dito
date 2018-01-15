import { isObject, isString, asArray, capitalize } from 'dito-utils'
import {
  Relation,
  BelongsToOneRelation,
  HasOneRelation,
  HasOneThroughRelation,
  HasManyRelation,
  ManyToManyRelation
} from 'objection'

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
  constructor(reference, models) {
    this.modelClass = null
    this.propertyNames = []
    // Parse and validate model key references
    for (const ref of asArray(reference)) {
      const [modelName, propertyName] = ref?.split('.') || []
      const modelClass = models[modelName]
      if (!modelClass) {
        throw new Error(
          `Unknown model property reference: ${ref}`)
      } else if (!this.modelClass) {
        this.modelClass = modelClass
      } else if (this.modelClass !== modelClass) {
        throw new Error(
          `Composite keys need to be defined on the same model: ${ref}`)
      }
      this.propertyNames.push(propertyName)
    }
  }

  toArray() {
    const modelName = this.modelClass.name
    return this.propertyNames.map(propName => `${modelName}.${propName}`)
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
    const fromClass = this.modelClass
    const fromProperties = this.propertyNames
    const toClass = to.modelClass
    const toProperties = to.propertyNames
    if (fromProperties.length !== toProperties.length) {
      throw new Error(`Unable to create through join for ` +
        `composite keys from '${this}' to '${to}'`)
    }
    const through = { from: [], to: [] }
    for (let i = 0; i < fromProperties.length; i++) {
      const fromProperty = fromProperties[i]
      const toProperty = toProperties[i]
      if (fromProperty && toProperty) {
        const throughName = `${fromClass.name}${toClass.name}`
        const throughFrom = `${fromClass.name}${capitalize(fromProperty)}`
        const throughto = `${toClass.name}${capitalize(toProperty)}`
        through.from.push(`${throughName}.${throughFrom}`)
        through.to.push(`${throughName}.${throughto}`)
      } else {
        throw new Error(
          `Unable to create through join from '${this}' to '${to}'`)
      }
    }
    return through
  }
}

function convertReleation(schema, models) {
  let {
    relation,
    // Dito-style relation description:
    from, through, inverse, to, scope,
    // Objection.js-style relation description
    join, modify, filter,
    ...rest
  } = schema || {}
  const relationClass = relationLookup[relation] ||
    relationClasses[relation] || relation
  if (!(relationClass?.prototype instanceof Relation)) {
    throw new Error(`Unrecognized relation: ${relation}`)
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
    from = new ModelReference(from, models)
    to = new ModelReference(to, models)
    if (throughRelationClasses[relationClass.name]) {
      // If the through setting is set to `true` on relations that required
      // a `through` configuration, auto-generate it, see buildThrough():
      if (through === true) {
        through = inverse ? to.buildThrough(from) : from.buildThrough(to)
      } else if (!through) {
        throw new Error('Relation needs a through definition or a ' +
          '`through: true` setting to auto-generate it')
      } else {
        // Convert optional through model name to class
        const { modelClass } = through
        if (isString(modelClass)) {
          through.modelClass = models[modelClass]
        }
      }
    } else if (through) {
      throw new Error('Unsupported through join definition')
    }
    modify = scope || modify || filter
    if (isObject(modify)) {
      // Convert a find-filter object to a filter function, same as in the
      // handling of definition.scopes, see Model.js
      modify = builder => builder.find(modify)
    }
    return {
      relation: relationClass,
      modelClass: to.modelClass,
      join: {
        from: from.toArray(),
        through,
        to: to.toArray()
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
      converted[name] = convertReleation(relation, models)
    } catch (err) {
      throw new Error(
        `${ownerModelClass.name}.relations.${name}: ${(err.message || err)}`)
    }
  }
  return converted
}

/**
 * Adds json schema properties for each of the modelClass' relations.
 */
export function addRelationSchemas(modelClass, jsonSchema) {
  const relations = modelClass.getRelations()
  const { properties } = jsonSchema
  for (const [name, relation] of Object.entries(relations)) {
    const $ref = relation.relatedModelClass.name
    properties[name] = relation.isOneToOne()
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
