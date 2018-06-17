import { isObject, isArray, asArray, isString } from '@ditojs/utils'

// TODO: convert `nullable: true` to `type: [... 'null']` detection?

export function convertSchema(schema, options = {}) {
  if (isString(schema)) {
    // Nested shorthand expansion
    schema = { type: schema }
  } else if (isArray(schema)) {
    // Needed for anyOf, allOf, oneOf, items:
    schema = schema.map(entry => convertSchema(entry, options))
  }
  if (isObject(schema)) {
    // Shallow clone so we can modify and return:
    schema = { ...schema }
    const { type } = schema
    if (isString(type)) {
      // Convert schema property notation to JSON schema
      const jsonType = jsonTypes[type]
      if (jsonType) {
        schema.type = jsonType
        if (jsonType === 'object') {
          if (schema.properties) {
            const properties = {}
            const required = []
            for (let [key, property] of Object.entries(schema.properties)) {
              property = expandSchemaShorthand(property)
              properties[key] = convertSchema(property, options)
              if (property?.required) {
                required.push(key)
              }
            }
            schema.properties = properties
            if (required.length > 0) {
              schema.required = required
            }
          }
          // TODO: convertSchema() on patternProperties
        } else if (jsonType === 'array') {
          const { items } = schema
          if (items) {
            schema.items = convertSchema(items, options)
          }
        }
      } else if (['date', 'datetime', 'timestamp'].includes(type)) {
        // date properties can be submitted both as a string or a Date object.
        // Provide validation through date-time format, which in Ajv appears
        // to handle both types correctly.
        schema.type = ['string', 'object']
        schema = addFormat(schema, 'date-time')
      } else {
        // A reference to another model as nested JSON data, use $ref or
        // instanceof instead of type, based on the passed option:
        if (options.useInstanceOf) {
          schema.type = 'object'
          schema.instanceof = type
        } else {
          delete schema.type
          schema.$ref = type
        }
      }
    } else {
      // Root properties schema or nested object without type that needs
      // expanding.
      schema = convertSchema(expandSchemaShorthand(schema), options)
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
      if (_default && !excludeDefaults[_default]) {
        schema.default = _default
      }
    }
    if (schema.nullable) {
      schema = makeNullable(schema)
    }
  }
  return schema
}

export function expandSchemaShorthand(schema) {
  if (isString(schema)) {
    schema = {
      type: schema
    }
  } else if (isArray(schema)) {
    schema = {
      type: 'array',
      items: schema.length > 1 ? schema : schema[0],
      // The array short-forms sets an empty array as the default.
      default: []
    }
  } else if (isObject(schema) && !isString(schema.type)) {
    schema = {
      type: 'object',
      properties: {
        ...schema
      },
      additionalProperties: false
    }
  }
  return schema
}

function addFormat(schema, newFormat) {
  // Support multiple `format` keywords through `allOf`:
  let { allOf, format, ...rest } = schema
  if (format || allOf) {
    allOf = allOf || []
    if (!allOf.find(({ format }) => format === newFormat)) {
      allOf.push({ format }, { format: newFormat })
      schema = { ...rest, allOf }
    }
  } else {
    schema.format = newFormat
  }
  return schema
}

function makeNullable(schema) {
  // Add 'null' to the allowed types through `oneOf`.
  // Move format along with type, and also support $ref and instanceof:
  const {
    type,
    $ref,
    instanceof: _instanceof,
    format,
    ...rest
  } = schema
  return isArray(type) && type.includes('null')
    ? schema
    : $ref || _instanceof || format
      ? {
        oneOf: [
          $ref
            ? { $ref }
            : {
              type,
              ...(_instanceof && { instanceof: _instanceof }),
              ...(format && { format })
            },
          { type: 'null' }
        ],
        ...rest
      }
      : {
        type: [...asArray(type), 'null'],
        ...rest
      }
}

// Table to translate schema types to JSON schema types. Other types are allowed
// also, e.g. 'date', 'datetime', 'timestamp', but they need special treatment.
// Anything not recognized as a type is used as a $ref instead.
const jsonTypes = {
  string: 'string',
  text: 'string',
  number: 'number',
  integer: 'integer',
  boolean: 'boolean',
  object: 'object',
  array: 'array'
}

const excludeDefaults = {
  'now()': true
}
