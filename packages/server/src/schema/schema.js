import { isObject, isArray, isString, isEmpty, equals } from '@ditojs/utils'

const schemaCaches = {}

function getSchemaCache(options, role) {
  const key = Object.entries({ ...options, role })
    .toSorted()
    .map(([key, value]) => `${key}:${value}`)
    .join(',')
  return (schemaCaches[key] ||= new WeakMap())
}

// `role` is 'definition' for the top level of definitions, 'part' for the
// items of `allOf`, which aren't closed on their own, and 'alternative' for the
// items of `anyOf` and `oneOf` whose references are closed at the outer level.
export function convertSchema(
  schema,
  options = {},
  parentEntry = null,
  role = null
) {
  if (!isObject(schema) && !isArray(schema)) {
    // Boolean schemas (`true`, `false`) and other non-object values have
    // nothing to convert, and can't be used as keys of the schema cache.
    return schema
  }

  const original = schema
  const isRoot = parentEntry === null

  const schemaCache = getSchemaCache(options, role)
  if (schemaCache.has(original)) {
    const { schema, definitions, parentEntries } = schemaCache.get(original)
    parentEntries.push(parentEntry)
    if (!isEmpty(definitions)) {
      if (isRoot) {
        return { ...schema, definitions }
      } else {
        mergeDefinitions(parentEntry.definitions, definitions)
      }
    }
    // During circular references, this is the converted schema that is still
    // being completed, see `entry.schema` below.
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
  let jsonType = null
  let unwrappedSchema = null
  if (isArray(schema)) {
    // Needed for allOf, anyOf, oneOf, not, items, see below. The items are
    // converted once `entry.schema` is set, see below:
    schema = []
  } else {
    // Create a shallow clone so we can modify and return:
    // Also collect and propagate the definitions up to the root schema through
    // `options.definitions`, as passed from `Model static get jsonSchema()`:
    const { definitions: defs, ...rest } = schema
    definitions = defs
    schema = rest
    const { $ref, type } = schema
    jsonType = jsonTypes[type] ?? null

    if (schema.required === true) {
      // Our 'required' is not the same as JSON Schema's: Use the 'required'
      // format instead that only validates if the required value is not empty,
      // meaning neither nullish nor an empty string. The JSON schema `required`
      // array is generated separately below through `convertProperties()`.
      delete schema.required
      schema = addFormat(schema, 'required')
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
        }
      }
    }
    if (excludeDefaults[schema.default]) {
      delete schema.default
    }
    // `nullable` may wrap the schema in `else` below, but its nested schemas
    // remain on the wrapped schema:
    unwrappedSchema = schema
    if (schema.nullable) {
      if (schema.$ref) {
        // `$ref` doesn't play with `nullable`, so convert to `if` / `else`,
        // where Ajv applies the defaults of the referenced schema, unlike in
        // `oneOf`. Keep the property's own default outside, for Ajv to see:
        const { default: value } = schema
        delete schema.nullable
        delete schema.default
        schema = {
          if: { type: 'null' },
          else: schema,
          ...(value !== undefined && { default: value })
        }
      } else if (schema.enum && !schema.enum.includes(null)) {
        // Make nullable work with enum, see the issue for more details:
        // https://github.com/ajv-validator/ajv/issues/1471
        schema.enum.push(null)
      }
    }
  }

  entry.schema = schema

  try {
    // Only convert nested schemas and definitions once `entry.schema` is set,
    // so that circular references resolve to the schema being converted.
    if (isArray(original)) {
      for (const item of original) {
        schema.push(convertSchema(item, options, entry, role))
      }
    } else {
      convertNestedSchemas(unwrappedSchema, jsonType, options, entry, role)
    }
    if (definitions) {
      mergeDefinitions(
        entry.definitions,
        convertDefinitions(definitions, options, entry)
      )
    }
  } catch (error) {
    // Don't serve the partially converted schema from the cache:
    schemaCache.delete(original)
    throw error
  }

  if (!isEmpty(entry.definitions)) {
    // Propagate the definitions up the parent entry chains, that due to
    // circular references may not be up to date yet.
    mergeDefinitionsRecursively(entry, entry.definitions)
    if (isRoot) {
      // Don't add the definitions to the cached schema itself, as it may be
      // referenced from within the definitions, or reused as a nested schema:
      return { ...schema, definitions: entry.definitions }
    }
  }

  return schema
}

function convertNestedSchemas(schema, jsonType, options, entry, role) {
  // Convert array items
  schema.prefixItems &&= convertSchema(schema.prefixItems, options, entry)
  schema.items &&= convertSchema(schema.items, options, entry)

  // Handle nested allOf, anyOf, oneOf & co. fields. References in `anyOf` and
  // `oneOf` are closed on their own, except next to properties that they don't
  // evaluate, or next to a discriminator, as Ajv only finds its tag in plain
  // references:
  const isClosedOutside = !!(
    schema.discriminator ||
    schema.properties ||
    schema.$ref
  )
  for (const key of ['allOf', 'anyOf', 'oneOf', 'not']) {
    if (key in schema) {
      schema[key] = convertSchema(
        schema[key],
        options,
        entry,
        key === 'allOf'
          ? 'part'
          : compositionKeys.includes(key) && isClosedOutside
            ? 'alternative'
            : null
      )
    }
  }

  let hasConvertedProperties = false
  if (schema.properties) {
    const { properties, required } = convertProperties(
      schema.properties,
      options,
      entry
    )
    schema.properties = properties
    if (required.length > 0) {
      schema.required = [...new Set([...(schema.required ?? []), ...required])]
    }
    hasConvertedProperties = true
  }
  if (isObject(schema.additionalProperties)) {
    schema.additionalProperties = convertSchema(
      schema.additionalProperties,
      options,
      entry
    )
    hasConvertedProperties = true
  }
  if (isObject(schema.patternProperties)) {
    // TODO: Don't we need to handle required here too?
    const { properties } = convertProperties(
      schema.patternProperties,
      options,
      entry
    )
    schema.patternProperties = properties
    hasConvertedProperties = true
  }
  const { discriminator } = schema
  const hasComposition = compositionKeys.some(key => key in schema)
  const isReference = !!schema.$ref?.startsWith('#/definitions/')
  if (!('unevaluatedProperties' in schema)) {
    if (role === 'definition') {
      // As intended by JSON Schema 2020-12, we close definitions where they're
      // used: what the `$ref` target evaluates counts there, so definitions
      // stay reusable as bases. Objects without properties stay open:
      if (
        jsonType === 'object' &&
        !hasConvertedProperties &&
        !hasComposition &&
        !isReference &&
        !discriminator
      ) {
        schema.unevaluatedProperties = true
      }
    } else if (
      // Objects combined from parts are closed at the outer level, where
      // `unevaluatedProperties` sees the properties of all parts:
      role !== 'part' && (
        jsonType && hasConvertedProperties ||
        jsonType === 'object' && hasComposition ||
        discriminator ||
        // `unevaluatedProperties` only applies to objects, and also sees what
        // an explicit `unevaluatedProperties: true` of the target evaluated:
        isReference && role !== 'alternative'
      )
    ) {
      // Invert the logic of `unevaluatedProperties` so that it needs to be
      // explicitly set to `true`:
      schema.unevaluatedProperties = false
    }
  }
  if (discriminator) {
    // Ajv evaluates `unevaluatedProperties` before `discriminator` in the
    // same schema object, so we move it with its `oneOf` into an `allOf` part,
    // with the tag that Ajv needs to be required. `Model.getProperty()` needs
    // the implied type, as it can't infer it from the moved keywords:
    const { oneOf } = schema
    delete schema.discriminator
    delete schema.oneOf
    schema.type ??= 'object'
    schema.allOf = [
      ...(schema.allOf ?? []),
      { discriminator, oneOf, required: [discriminator.propertyName] }
    ]
  }
}

function convertProperties(schemaProperties, options, entry) {
  const properties = {}
  const required = []
  for (const [key, property] of Object.entries(schemaProperties)) {
    properties[key] = convertSchema(property, options, entry)
    // Only Dito.js' `required: true`, not JSON Schema's `required` array:
    if (property?.required === true) {
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
    converted[key] = convertSchema(schema, options, entry, 'definition')
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
        allOf: [
          ...(allOf ?? []),
          ...(format ? [{ format }] : []),
          { format: newFormat }
        ]
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

const compositionKeys = ['allOf', 'anyOf', 'oneOf']

const excludeDefaults = {
  'now()': true
}
