import { isObject, isArray, isString, asArray } from '../utils'
import {
  Relation,
  BelongsToOneRelation,
  HasOneRelation,
  HasOneThroughRelation,
  HasManyRelation,
  ManyToManyRelation
} from 'objection'

export function convertSchema(schema, validator,
  { isRoot, isItems } = { isRoot: true }) {
  // Shallow clone so we can modify and return:
  schema = { ...schema }
  const { type } = schema
  if (isString(type)) {
    // Convert schema property notation to JSON schema
    if (jsonTypes[type]) {
      if (type === 'array') {
        const { items } = schema
        if (items) {
          schema.items = convertSchema(items, validator, { isItems: true })
        }
      }
    } else if (['date', 'datetime', 'timestamp'].includes(type)) {
      // date properties can be submitted both as a string or a Date object.
      // Provide validation through date-time format, which in AJV appears
      // to handle both types correctly.
      schema.type = ['string', 'object']
      addFormat(schema, 'date-time')
    } else {
      // A reference to another model as nested JSON data, use $ref instead
      // of type, but append '_required' to use the version of the schema
      // that has the 'required' keyword defined.
      delete schema.type
      schema.$ref = type
    }
  } else {
    // Root properties schema or nested objects
    const properties = schema
    const required = []
    for (const [key, value] of Object.entries(schema)) {
      const property = isObject(value) ? value : { type: value }
      if (property.required) {
        required.push(key)
      }
      properties[key] = convertSchema(property, validator, {})
    }
    schema = {
      type: 'object',
      properties,
      ...(required.length > 0 && { required })
    }
  }
  if (!isRoot) {
    // Our 'required' is not the same as JSON Schema's: Use the 'required'
    // format instead that only validates if required string is not empty.
    const { required } = schema
    if (required !== undefined) {
      if (required) {
        addFormat(schema, 'required')
      }
      delete schema.required
    }
    if (!required && !isItems) {
      // If not required, add 'null' to the allowed types
      const { type, $ref } = schema
      if (type) {
        schema.type = [...(isArray(type) ? type : [type]), 'null']
      } else if ($ref) {
        schema = {
          anyOf: [schema, { type: 'null' }]
        }
      }
    }
  }
  // Remove all keywords that aren't valid JSON keywords.
  for (const key of Object.keys(schema)) {
    if (!validator.isKeyword(key)) {
      delete schema[key]
    }
  }
  return schema
}

function addFormat(schema, format) {
  // Support multiple `format` keywords through `allOf`:
  const { allOf } = schema
  if (schema.format || allOf) {
    (allOf || (schema.allOf = [])).push({ format })
  } else {
    schema.format = format
  }
}

// JSON types, used to determine when to use `$ref` instead of `type`.
const jsonTypes = {
  string: true,
  number: true,
  integer: true,
  boolean: true,
  object: true,
  array: true
}

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

export function convertRelations(ownerModelClass, schema, models) {
  function convertReference(reference) {
    const [modelName, propertyName] = reference.split('.')
    const modelClass = models[modelName]
    if (modelClass) {
      const columnName = modelClass.propertyNameToColumnName(propertyName)
      return `${modelClass.tableName}.${columnName}`
    }
    return reference
  }

  const relations = {}
  for (const [name, relationSchema] of Object.entries(schema)) {
    let { relation, modelClass, join: { from, to }, ...rest } = relationSchema
    const relationClass = relationLookup[relation] ||
      relationClasses[relation] || relation
    if (relationClass && relationClass.prototype instanceof Relation) {
      from = asArray(from).map(convertReference)
      to = asArray(to).map(convertReference)
      relations[name] = {
        relation: relationClass,
        modelClass: models[modelClass] || modelClass,
        join: { from, to },
        ...rest
      }
    } else {
      throw new Error(
        `${ownerModelClass.name}.relations.${name}: Unrecognized relation`)
    }
  }
  return relations
}
