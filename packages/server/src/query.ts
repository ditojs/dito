import { z } from 'zod'
import { asArray, isObject } from '@ditojs/utils'

// Query values arrive as strings. Before a schema validates them, they become
// what it expects, read from its JSON Schema: numbers, booleans, dates, and
// arrays of these from all values of a key. Strings that don't convert stay
// strings, so that the schema rejects them. Unions, transforms and all other
// types get the strings as they are.

type JsonSchema = z.core.JSONSchema.BaseSchema

const jsonSchemas = new WeakMap<z.ZodType, JsonSchema>()

const booleans: Record<string, boolean> = {
  true: true,
  1: true,
  false: false,
  0: false
}

// Converts the values of a query, by key, to the properties of `schema`. Keys
// that it doesn't describe keep their string, or their strings when repeated.
export function convertQuery(
  schema: z.ZodType,
  query: Record<string, string[]>
) {
  const { properties = {} } = getJsonSchema(schema)
  return Object.fromEntries(
    Object.entries(query).map(([key, values]) => [
      key,
      Object.hasOwn(properties, key)
        ? convertValues(properties[key] as JsonSchema, values)
        : values.length === 1
          ? values[0]
          : values
    ])
  )
}

// Converts one value or the values of a repeated key, such as the arguments of
// a list filter, to what `schema` expects.
export function convertQueryValue(
  schema: z.ZodType,
  value: string | string[]
) {
  return convertValues(getJsonSchema(schema), asArray(value))
}

// The JSON Schema of the input, once per schema. Dates have no JSON Schema, so
// they get `instanceof: 'Date'`. An empty registry inlines the schemas that
// have an id in the global one, instead of referencing them in `$defs`.
function getJsonSchema(schema: z.ZodType) {
  let jsonSchema = jsonSchemas.get(schema)
  if (!jsonSchema) {
    jsonSchema = z.toJSONSchema(schema, {
      io: 'input',
      metadata: z.registry(),
      unrepresentable: ({ zodSchema }) =>
        zodSchema instanceof z.ZodDate ? { instanceof: 'Date' } : 'any'
    })
    jsonSchemas.set(schema, jsonSchema)
  }
  return jsonSchema
}

// An array takes all values. Other types take a single value, and get the
// values of a repeated key as they are, for the schema to reject.
function convertValues(schema: JsonSchema, values: string[]) {
  const { type, items } = getType(schema)
  // Tuples have `prefixItems` instead of `items`, and get the strings.
  return type === 'array' && isObject(items)
    ? values.map(value => convertValue(items, value))
    : values.length === 1
      ? convertValue(schema, values[0]!)
      : values
}

function convertValue(schema: JsonSchema, value: string) {
  const { type } = getType(schema)
  if (type === 'number' || type === 'integer') {
    // `Number('')` is 0, so empty strings stay strings.
    return value.trim() === '' ? value : Number(value)
  } else if (type === 'boolean') {
    return Object.hasOwn(booleans, value) ? booleans[value] : value
  } else if (type === 'Date') {
    const date = new Date(value)
    return isNaN(date.getTime()) ? value : date
  }
  return value
}

// The one type that `schema` describes besides `null`, with its `items`, else
// no type, such as for unions.
function getType(schema: JsonSchema): { type?: string; items?: unknown } {
  if (schema.anyOf) {
    const schemas = schema.anyOf.filter(item => item.type !== 'null')
    return schemas.length === 1 ? getType(schemas[0]!) : {}
  }
  const types = asArray(schema.type).filter(type => type !== 'null')
  return {
    items: schema.items,
    type:
      schema.instanceof === 'Date'
        ? 'Date'
        : types.length === 1
          ? types[0]
          : undefined
  }
}
