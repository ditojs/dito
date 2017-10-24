import { asArray } from '@/utils'
import {
  Relation,
  BelongsToOneRelation,
  HasOneRelation,
  HasOneThroughRelation,
  HasManyRelation,
  ManyToManyRelation
} from 'objection'

const relationLookup = {
  // oneToOne:
  belongsToOne: BelongsToOneRelation,
  hasOne: HasOneRelation,
  hasOneThrough: HasOneThroughRelation,
  // toMany:
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

export default function convertRelations(ownerModelClass, schema, models) {
  function convertReference(reference) {
    const [modelName, propertyName] = reference && reference.split('.') || []
    const modelClass = models[modelName]
    if (modelClass) {
      const columnName = modelClass.propertyNameToColumnName(propertyName)
      return `${modelClass.tableName}.${columnName}`
    }
    return reference
  }

  function convertReferences(references) {
    return asArray(references).map(convertReference)
  }

  const relations = {}
  for (const [name, relationSchema] of Object.entries(schema)) {
    let {
      relation,
      modelClass,
      join: {
        from, through, to
      } = {},
      scope,
      modify,
      filter,
      ...rest
    } = relationSchema || {}
    const relationClass = relationLookup[relation] ||
      relationClasses[relation] || relation
    if (relationClass && relationClass.prototype instanceof Relation) {
      from = convertReferences(from)
      to = convertReferences(to)
      if (relationClass === ManyToManyRelation) {
        // TODO: ...!
        if (!through) {
        } else {
          let { modelClass: throughModelClass } = through
          throughModelClass = models[throughModelClass] || throughModelClass
          through = {
            from: convertReferences(through.from),
            to: convertReferences(through.to)
          }
          if (throughModelClass) {
            throughModelClass.modelClass = throughModelClass
          }
        }
      } else if (through) {
        throw new Error(
          `${ownerModelClass.name}.relations.${name}: ` +
          `Unsupported through relation: ${relation}`)
      }
      // TODO: parse / auto-create through based on relationClass!
      relations[name] = {
        relation: relationClass,
        modelClass: models[modelClass] || modelClass,
        join: { from, through, to },
        modify: scope || modify || filter,
        ...rest
      }
    } else {
      throw new Error(
        `${ownerModelClass.name}.relations.${name}: ` +
        `Unrecognized relation: ${relation}`)
    }
  }
  return relations
}
