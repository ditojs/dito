import { isObject, isArray, isString, equals } from '@ditojs/utils'

const schemaCaches = {}

function getSchemaCache(options) {
  const key = Object.entries(options || {})
    .toSorted()
    .map(([key, value]) => `${key}:${value}`)
    .join(',') || 'default'
  return (schemaCaches[key] ||= new WeakMap())
}

export function convertSchema(
  schema,
  options = {},
  parentEntry = null
) {
  const original = schema
  const isRoot = parentEntry === null

  const schemaCache = getSchemaCache(options)
  if (schemaCache.has(original)) {
    const { schema, definitions, parentEntries } = schemaCache.get(original)
    parentEntries.push(parentEntry)
    if (definitions) {
      if (isRoot) {
        return { ...schema, definitions }
      } else {
        mergeDefinitions(parentEntry.definitions, definitions)
      }
    }
    return schema
  }

  const entry = {
    schema: null,
    definitions: {},
    parentEntries: parentEntry ? [parentEntry] : []
  }

  // To prevent circular references, cache the entry before all conversion work.
  schemaCache.set(original, entry)

  let definitions = null
  if (isArray(schema)) {
    // Needed for allOf, anyOf, oneOf, not, items, see below:
    schema = schema.map(item => convertSchema(item, options, entry))
  } else if (isObject(schema)) {
    // Create a shallow clone so we can modify and return:
    // Also collect and propagate the definitions up to the root schema through
    // `options.definitions`, as passed from `Model static get jsonSchema()`:
    const { definitions: defs, ...rest } = schema
    definitions = defs
    schema = rest
    const { $ref, type } = schema
    const jsonType = jsonTypes[type]

    if (schema.required === true) {
      // Our 'required' is not the same as JSON Schema's: Use the 'required'
      // format instead that only validates if the required value is not empty,
      // meaning neither nullish nor an empty string. The JSON schema `required`
      // array is generated separately below through `convertProperties()`.
      delete schema.required
      schema = addFormat(schema, 'required')
    }

    // Convert array items
    schema.prefixItems &&= convertSchema(schema.prefixItems, options, entry)
    schema.items &&= convertSchema(schema.items, options, entry)

    // Handle nested allOf, anyOf, oneOf & co. fields
    for (const key of ['allOf', 'anyOf', 'oneOf', 'not', '$extend']) {
      if (key in schema) {
        schema[key] = convertSchema(schema[key], options, entry)
      }
    }

    if (isString($ref)) {
      // If the $ref is a nested Dito.js definition, convert it to a JSON schema
      // reference. If it is a full URL, use it as is.
      schema.$ref = $ref.startsWith('#')
        ? `#/definitions/${$ref}`
        : $ref
    } else if (isString(type)) {
      if (jsonType) {
        schema.type = jsonType
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

    // Convert properties last. This is needed for circular references
    // to work correctly, as the properties may reference the same schema
    // that is being converted right now.
    let hasConvertedProperties = false
    if (schema.properties) {
      const { properties, required } = convertProperties(
        schema.properties,
        options,
        entry
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
        options,
        entry
      )
      schema.patternProperties = properties
      hasConvertedProperties = true
    }
    if (
      jsonType &&
      (hasConvertedProperties || schema.discriminator) &&
      !('unevaluatedProperties' in schema)
    ) {
      // Invert the logic of `unevaluatedProperties` so that it needs to be
      // explicitly set to `true`:
      schema.unevaluatedProperties = false
    }
  }

  entry.schema = schema

  // Only convert definitions once `entry.schema` is set, so that it works as
  // expected with circular references.
  if (definitions) {
    mergeDefinitions(
      entry.definitions,
      convertDefinitions(definitions, options, entry)
    )
  }

  if (Object.keys(entry.definitions).length > 0) {
    // Propagate the definitions up the parent entry chains, that due to
    // circular references may not be up to date yet.
    mergeDefinitionsRecursively(entry, entry.definitions)
    if (isRoot) {
      schema.definitions = entry.definitions
    }
  }

  return schema
}

function convertProperties(schemaProperties, options, entry) {
  const properties = {}
  const required = []
  for (const [key, property] of Object.entries(schemaProperties)) {
    properties[key] = convertSchema(property, options, entry)
    if (property?.required) {
      required.push(key)
    }
  }
  return { properties, required }
}

function convertDefinitions(definitions, options, entry) {
  let converted = null
  for (const [key, schema] of Object.entries(definitions)) {
    if (!key.startsWith('#')) {
      throw new Error(
        `Invalid definition '${
          key
        }', the name of nested Dito.js definitions must start with '#': ${
          JSON.stringify(schema)
        }`
      )
    }
    converted ??= {}
    converted[key] = convertSchema(schema, options, entry)
  }
  return converted
}

function mergeDefinitions(definitions, defs) {
  for (const [key, def] of Object.entries(defs)) {
    const definition = definitions[key]
    if (definition && !equals(definition, def)) {
      throw new Error(
        `Duplicate nested definition for '${key}' with different schema: ${
          JSON.stringify(def, null, 2)
        }, ${
          JSON.stringify(definition, null, 2)
        }`
      )
    }
    definitions[key] ??= def
  }
}

function mergeDefinitionsRecursively(
  entry,
  definitions,
  visited = new WeakSet()
) {
  if (!visited.has(entry)) {
    visited.add(entry)

    if (definitions !== entry.definitions) {
      mergeDefinitions(entry.definitions, definitions)
    }
    for (const parentEntry of entry.parentEntries) {
      mergeDefinitionsRecursively(parentEntry, definitions, visited)
    }
  }
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
