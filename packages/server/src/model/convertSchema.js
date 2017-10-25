import { isObject, isArray, isString } from '@/utils'

export default function convertSchema(schema) {
  if (isObject(schema)) {
    // Shallow clone so we can modify and return:
    schema = { ...schema }
    const { type } = schema
    if (isString(type)) {
      // Convert schema property notation to JSON schema
      if (jsonTypes[type]) {
        if (type === 'array') {
          const { items } = schema
          if (items) {
            // Expand `{ items: type }` to `{ items: { type } }`, and if type
            // is a $ref, then further to `{ items: { $ref: type } }`:
            schema.items = convertSchema(
              isString(items) ? { type: items } : items)
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
      for (let [key, property] of Object.entries(schema)) {
        if (isArray(property)) {
          property = {
            type: 'array',
            items: property.length > 1 ? property : property[0]
          }
        } else if (property && property.required) {
          required.push(key)
        }
        properties[key] = isObject(property)
          ? convertSchema(property)
          : property
      }
      schema = {
        type: 'object',
        properties,
        ...(required.length > 0 && { required })
      }
    }
    if (schema.type !== 'object') {
      const {
        required,
        default: _default,
        ...rest
      } = schema
      schema = rest
      if (required) {
        // Our 'required' is not the same as JSON Schema's: Use the 'required'
        // format instead that only validates if required string is not empty.
        schema = addFormat(schema, 'required')
      }
      if (schema.nullable) {
        schema = makeNullable(schema)
      }
      if (_default && !excludeDefaults[_default]) {
        schema.default = _default
      }
    }
  } else if (isArray(schema)) {
    schema = schema.map(entry => convertSchema(entry))
  }
  return schema
}

function addFormat(schema, newFormat) {
  // Support multiple `format` keywords through `allOf`:
  const { allOf, format, ...rest } = schema
  if (format || allOf) {
    schema = { ...rest, allOf: allOf || [] }
    schema.allOf.push({ format }, { format: newFormat })
  } else {
    schema.format = newFormat
  }
  return schema
}

function makeNullable(schema) {
  // Add 'null' to the allowed types through `anyOf`.
  // Move format along with type, and also support $ref:
  // TODO: Check that it doesn't already specify `type: null`!
  const { type, $ref, format, ...rest } = schema
  return {
    anyOf: [
      $ref ? { $ref } : format ? { type, format } : { type },
      { type: 'null' }
    ],
    ...rest
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

const excludeDefaults = {
  'now()': true
}
