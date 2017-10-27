import { asArray, camelize } from '@/utils'
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

export function convertRelations(ownerModelClass, schema, models) {
  function convertReference(reference) {
    // Converts ModelClass.propertyName to table_name.column_name, if not
    // already provided in that format.
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

  function parseReference(reference) {
    // NOTE: This assumes references are always passed as tableName.columnName,
    // and returned as [modelClass, columnName]
    const [tableName, columnName] = reference && reference.split('.') || []
    return [getModelClassByTableName(tableName), columnName]
  }

  let modelsByTableName
  function getModelClassByTableName(name) {
    // Create a lookup table for tableName -> modelClass on the first call:
    if (!modelsByTableName) {
      modelsByTableName = Object.values(models).reduce((res, modeClass) => {
        res[modeClass.tableName] = modeClass
        return res
      }, {})
    }
    return modelsByTableName[name]
  }

  function throwError(relationName, message) {
    throw new Error(
      `${ownerModelClass.name}.relations.${relationName}: ` + message)
  }

  const relations = {}
  for (const [relationName, relationSchema] of Object.entries(schema)) {
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
      const throughRelation = throughRelationClasses[relationClass.name]
      if (throughRelation) {
        if (!through) {
          // If no through settings are provided on relations that required it,
          // auto-generate it based on simple conventions:
          // - The through table is called:
          //   `${fromTable}_${toTable}`
          // - The from property is called:
          //   `${camelize(fromModelName)}${camelize(fromProp, true)}`
          // - The to property is called:
          //   `${camelize(toModelName)}${camelize(toProp, true)}`
          if (from.length !== to.length) {
            throwError(relationName, `Unable to create through join for ` +
              `composite keys from '${from}' to '${to}'`)
          }
          through = { from: [], to: [] }
          for (let i = 0; i < from.length; i++) {
            const [fromClass, fromColumn] = parseReference(from[i])
            const [toClass, toColumn] = parseReference(to[i])
            if (fromClass && toClass && fromColumn && toColumn) {
              const tableName = `${fromClass.tableName}_${fromClass.tableName}`
              const fromProp = `${camelize(fromClass.name)}${
                camelize(fromClass.columnNameToPropertyName(fromColumn), true)}`
              const toProp = `${camelize(toClass.name)}${
                camelize(fromClass.columnNameToPropertyName(toColumn), true)}`
              through.from.push(`${tableName}.${
                fromClass.propertyNameToColumnName(fromProp)}`)
              through.to.push(`${tableName}.${
                fromClass.propertyNameToColumnName(toProp)}`)
            } else {
              throwError(relationName,
                `Unable to create through join from '${from[i]}' to '${to[i]}'`)
            }
          }
        }
        let { modelClass: throughModelClass } = through
        throughModelClass = models[throughModelClass] || throughModelClass
        through = {
          from: convertReferences(through.from),
          to: convertReferences(through.to)
        }
        if (throughModelClass) {
          through.modelClass = throughModelClass
        }
      } else if (through) {
        throwError(relationName, 'Unsupported through join')
      }
      relations[relationName] = {
        relation: relationClass,
        modelClass: models[modelClass] || modelClass,
        join: { from, through, to },
        modify: scope || modify || filter,
        ...rest
      }
    } else {
      throwError(relationName, `Unrecognized relation: ${relation}`)
    }
  }
  return relations
}
