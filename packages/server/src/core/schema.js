import { isObject, isArray, isString, isFunction } from '../utils'
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
  const typeValue = schema.type
  const type = isFunction(typeValue) ? typeValue.name : typeValue
  if (isArray(type)) {
    // Convert schema array notation to JSON schema
    schema.type = 'array'
    const arrayType = type[0]
    const items = isObject(arrayType) ? arrayType : { type: arrayType }
    schema.items = convertSchema(items, validator, { isItems: true })
  } else if (isString(type)) {
    // Convert schema property notation to JSON schema
    const typeLower = type.toLowerCase()
    if (jsonTypes[typeLower]) {
      schema.type = typeLower
    } else if (typeLower === 'date') {
      // date properties can be submitted both as a string or a Date object.
      // Provide validation through date-time format, which in AJV appears
      // to handle both types correctly.
      schema.type = ['string', 'object']
      if (!schema.format) {
        schema.format = 'date-time'
      }
    } else {
      console.log('$ref', type)
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
        // Support multiple `format` keywords through `allOf`:
        const { format, allOf } = schema
        if (format || allOf) {
          (allOf || (schema.allOf = [])).push({ format: 'required' })
        } else {
          schema.format = 'required'
        }
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
  // Expand multi-line array descriptions into one string.
  const { description } = schema
  if (description && isArray(description)) {
    schema.description = description.join(' ')
  }
  // Remove all keywords that aren't valid JSON keywords.
  for (const key of Object.keys(schema)) {
    if (!validator.isKeyword(key)) {
      delete schema[key]
    }
  }
  return schema
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
  const relations = {}
  for (const [name, relationSchema] of Object.entries(schema)) {
    const { relation, modelClass, ...rest } = relationSchema
    const relationClass = relationLookup[relation] ||
      relationClasses[relation] || relation
    if (relationClass && relationClass.prototype instanceof Relation) {
      relations[name] = {
        relation: relationClass,
        modelClass: models[modelClass] || modelClass,
        ...rest
      }
    } else {
      throw new Error(
        `${ownerModelClass.name}.relations.${name}: Unrecognized relation`)
    }
  }
  return relations
}
