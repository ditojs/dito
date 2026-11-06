import { isString } from '@ditojs/utils'
import {
  ArrayType,
  DecimalType,
  EnumArrayType,
  ReferenceKind,
  type EntityProperty
} from '@mikro-orm/core'
import { z } from 'zod'
import { integerBits, isOwned, isOwningToOne } from './metadata.ts'

// Zod schemas of the columns of writes, generated from the metadata, so that
// each column is declared once. They check what Postgres can't check well:
// MikroORM converts some values silently, such as any string to `true` for a
// boolean, and Postgres refuses others without naming a field.

const schemas = new WeakMap<EntityProperty, z.ZodType>()

// A date column takes plain dates too, as local midnight.
const dateSchema = z.union([z.iso.datetime({ offset: true }), z.iso.date()], {
  error: 'Invalid input: expected date'
})

// The schema of a custom type runs on the values that pass the column's checks.
export function getColumnSchema(prop: EntityProperty) {
  let schema = schemas.get(prop)
  if (!schema) {
    const { schema: custom } = (prop.customType ?? {}) as { schema?: z.ZodType }
    schema = custom ? createSchema(prop).pipe(custom) : createSchema(prop)
    schemas.set(prop, schema)
  }
  return schema
}

// The type of a property, as messages name it.
export function getType(prop: EntityProperty) {
  const { runtimeType } = prop
  const isDecimalString = (
    prop.customType instanceof DecimalType &&
    runtimeType === 'string'
  )
  const isInteger = (
    runtimeType === 'number' &&
    (prop.columnTypes?.[0] ?? '') in integerBits
  )
  return isOwningToOne(prop)
    ? 'id'
    : isOwned(prop)
      ? 'object'
      : runtimeType === 'Date'
        ? 'date'
        : isDecimalString
          ? 'decimal'
          : isInteger
            ? 'int'
            : runtimeType
}

export function isRequired(prop: EntityProperty) {
  return (
    !prop.nullable &&
    prop.default === undefined &&
    prop.defaultRaw === undefined &&
    !prop.onCreate &&
    (prop.kind === ReferenceKind.SCALAR || isOwningToOne(prop))
  )
}

function createSchema(prop: EntityProperty): z.ZodType {
  if (prop.customType instanceof ArrayType) {
    const type = getItemType(prop)
    return z.array(
      prop.customType instanceof EnumArrayType && prop.items
        ? getEnumSchema(prop.items)
        : getTypeSchema(type)
    )
  }
  const type = getType(prop)
  const { items, length, precision, scale = 0 } = prop
  if (prop.enum && items) return getEnumSchema(items)
  if (prop.customType instanceof DecimalType && precision) {
    // Postgres rounds the fraction to the scale, but refuses more integer
    // digits than the precision leaves:
    const limit = 10 ** (precision - scale)
    return getTypeSchema(type)
      .transform(Number)
      .pipe(z.number().lt(limit).gt(-limit))
  }
  if (type === 'string') {
    const schema = length ? z.string().max(length) : z.string()
    // As the `required` of Dito.js 6, a required string can't be empty.
    return isRequired(prop) ? schema.min(1) : schema
  }
  return getTypeSchema(type)
}

function getTypeSchema(type: string): z.ZodType {
  switch (type) {
    case 'string':
      return z.string()
    case 'number':
      return z.number()
    case 'int':
      return z.int()
    case 'boolean':
      return z.boolean()
    case 'date':
      return dateSchema
    case 'decimal':
      return customType('decimal', isDecimal)
    default:
      return z.unknown()
  }
}

function getEnumSchema(items: unknown[]) {
  return z.literal(items as string[])
}

function customType(expected: string, isValid: (value: unknown) => boolean) {
  return z.unknown().superRefine((value, context) => {
    if (!isValid(value)) {
      context.addIssue({
        code: 'invalid_type',
        expected,
        input: value
      } as never)
    }
  })
}

// Decimals in string mode take numbers too.
function isDecimal(value: unknown) {
  return (
    Number.isFinite(value) ||
    (isString(value) && value.trim() !== '' && Number.isFinite(Number(value)))
  )
}

// MikroORM gives all array columns the type `string[]`, so read the type of the
// column, such as `int[]`:
function getItemType(prop: EntityProperty) {
  const column = (prop.columnTypes?.[0] ?? '').replace(/(\(.*\))?\[\]$/, '')
  return column in integerBits
    ? 'int'
    : /^(numeric|decimal|real|double|float)/.test(column)
      ? 'number'
      : /^bool/.test(column)
        ? 'boolean'
        : 'string'
}
