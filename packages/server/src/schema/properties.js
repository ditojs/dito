import { isObject, isArray, isString } from '@ditojs/utils'

export function convertSchema(schema, options = {}) {
  if (isArray(schema)) {
    // Needed for allOf, anyOf, oneOf, not, items:
    schema = schema.map(entry => convertSchema(entry, options))
  } else if (isObject(schema)) {
    // Create a shallow clone so we can modify and return:
    schema = { ...schema }
    const { type } = schema
    if (schema.required === true) {
      // Our 'required' is not the same as JSON Schema's: Use the 'required'
      // format instead that only validates if the required value is not empty,
      // meaning neither nullish nor an empty string. The JSON schema `required`
      // array is generated seperately below through `convertProperties()`.
      delete schema.required
      schema = addFormat(schema, 'required')
    }

    // Convert properties
    let hasConvertedProperties = false
    if (schema.properties) {
      const { properties, required } = convertProperties(
        schema.properties,
        options
      )
      schema.properties = properties
      if (required.length > 0) {
        schema.required = required
      }
      hasConvertedProperties = true
    }
    if (schema.patternProperties) {
      // TODO: Don't we need to handle required here too?
      const { properties } = convertProperties(
        schema.patternProperties,
        options
      )
      schema.patternProperties = properties
      hasConvertedProperties = true
    }

    // Convert array items
    schema.prefixItems &&= convertSchema(schema.prefixItems, options)
    schema.items &&= convertSchema(schema.items, options)

    // Handle nested allOf, anyOf, oneOf, not fields
    for (const key of ['allOf', 'anyOf', 'oneOf', 'not']) {
      if (key in schema) {
        schema[key] = convertSchema(schema[key], options)
      }
    }

    if (isString(type)) {
      // Convert schema property notation to JSON schema
      const jsonType = jsonTypes[type]
      if (jsonType) {
        schema.type = jsonType
        if (hasConvertedProperties && !('additionalProperties' in schema)) {
          // Invert the logic of `additionalProperties` so that it needs to be
          // explicitely set to `true`:
          schema.additionalProperties = false
        }
      } else if (['date', 'datetime', 'timestamp'].includes(type)) {
        // Date properties can be submitted both as a string or a Date object.
        // Provide validation through date-time format, which in Ajv appears
        // to handle both types correctly.
        schema.type = ['string', 'object']
        schema = addFormat(schema, 'date-time')
      } else if (type !== 'null') {
        // A reference to another model as nested JSON data, use $ref or
        // instanceof instead of type, based on the passed option:
        if (options.useInstanceOf) {
          schema.type = 'object'
          schema.instanceof = type
        } else {
          // Move `type` to `$ref`, but still keep other properties for now,
          // to support `nullable`.
          delete schema.type
          // TODO: Consider moving to `model` keyword instead that would support
          // model validation and still could be combined with other keywords.
          schema.$ref = type
          // `$ref` doesn't play with `nullable`, so convert to `oneOf`
          if (schema.nullable) {
            delete schema.nullable
            schema = {
              oneOf: [
                { type: 'null' },
                schema
              ]
            }
          }
        }
      }
    }
    if (excludeDefaults[schema.default]) {
      delete schema.default
    }
    // Make nullable work with enum, see the issue for more details:
    // https://github.com/ajv-validator/ajv/issues/1471
    if (schema.nullable && schema.enum && !schema.enum.includes(null)) {
      schema.enum.push(null)
    }
  }
  return schema
}

export function convertProperties(schemaProperties, options) {
  const properties = {}
  const required = []
  for (const [key, property] of Object.entries(schemaProperties)) {
    properties[key] = convertSchema(property, options)
    if (property?.required) {
      required.push(key)
    }
  }
  return { properties, required }
}

function addFormat(schema, newFormat) {
  // Support multiple `format` keywords through `allOf`:
  const { allOf, format, ...rest } = schema
  if (format || allOf) {
    if (!allOf?.find(({ format }) => format === newFormat)) {
      schema = {
        ...rest,
        allOf: [...(allOf ?? []), { format }, { format: newFormat }]
      }
    }
  } else {
    schema.format = newFormat
  }
  return schema
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
