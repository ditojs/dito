import { z } from 'zod'
import {
  ReferenceKind,
  type EntityMetadata,
  type EntityProperty
} from '@mikro-orm/core'
import { createValidationError, type FieldError } from './errors.ts'
import { getOwnedRows } from './refs.ts'

// Builds the Zod schema of what a client may write to an entity from its
// MikroORM metadata, so each column is declared once, in the entity.
//
// - A column's type, length and nullability come from its column type.
// - A relation to one row is an id, or an object with an `id`.
// - A many-to-many relation is a list of those.
// - A one-to-many relation with `orphanRemoval` is owned: it is a list of
//   nested rows. A row without an `id` is new and needs its required columns.
// - Other one-to-many relations, the primary key, formulas, versions, columns
//   with `onCreate` or `onUpdate` and the columns in `readOnly` can't be
//   written.
//
// `rules` holds what the metadata can't say, per entity name: more columns
// that are read only, and stricter schemas for some columns. JSON columns take
// any JSON value without a rule. JSON values are checked against their schema
// but passed on as sent, since a rebuilt object has its keys in a new order,
// which MikroORM sees as a change, and since features such as `assets()`
// change the objects of the body in place.

export type WriteRules = Record<
  string,
  { readOnly?: string[]; fields?: Record<string, z.ZodType> }
>

export interface WriteSchemas {
  create: z.ZodObject
  patch: z.ZodObject
}

const id = z.number().int().positive()
const ref = z.union([id, z.object({ id }).transform(it => it.id)])
// A relation to one row may also name a new row of the same graph, see
// `refs.ts`.
const relation = z.union([ref, z.object({ '#ref': z.string() })])

export function buildWriteSchemas(
  meta: EntityMetadata,
  rules: WriteRules = {},
  parent?: string
): WriteSchemas {
  const rule = rules[meta.className] ?? {}
  const readOnly = new Set(rule.readOnly)
  const create: Record<string, z.ZodType> = {}
  const patch: Record<string, z.ZodType> = {}
  for (const prop of meta.props) {
    if (
      prop.primary ||
      prop.persist === false ||
      prop.formula ||
      prop.version ||
      prop.onCreate ||
      prop.onUpdate ||
      readOnly.has(prop.name) ||
      // The nesting sets the reference back to the owning row.
      prop.name === parent
    ) {
      continue
    }
    const field = rule.fields?.[prop.name]
    const schema = isJson(prop)
      ? asSent(field ?? z.json())
      : (field ?? getPropertySchema(prop, rules))
    if (!schema) continue
    patch[prop.name] = schema.optional()
    create[prop.name] = isRequired(prop) ? schema : schema.optional()
  }
  return { create: z.object(create), patch: z.object(patch) }
}

// Parses `data` with `schema`, and throws Dito's validation error.
export function parseWrite(schema: z.ZodType, data: unknown) {
  const result = schema.safeParse(data)
  if (!result.success) throw createValidationError(result.error.issues)
  return result.data as Record<string, unknown>
}

function getPropertySchema(prop: EntityProperty, rules: WriteRules) {
  switch (prop.kind) {
    case ReferenceKind.SCALAR:
      return nullable(prop, getColumnSchema(prop, prop.columnTypes[0]!))
    case ReferenceKind.MANY_TO_ONE:
      return nullable(prop, relation)
    case ReferenceKind.MANY_TO_MANY:
      // The inverse side is written through the owner.
      return prop.mappedBy ? null : z.array(ref)
    case ReferenceKind.ONE_TO_MANY: {
      if (!prop.orphanRemoval) return null
      const target = prop.targetMeta!
      const key = target.primaryKeys[0]!
      const { create, patch } = buildWriteSchemas(target, rules, prop.mappedBy)
      // A row without an id is new, and needs the columns a create needs.
      return z.array(
        patch
          .extend({ [key]: id.optional(), '#id': z.string().optional() })
          .superRefine((row, ctx) => {
            if (row[key] === undefined) {
              forwardIssues(create.safeParse(row), ctx, row)
            }
          })
      )
    }
    default:
      throw new Error(`No write schema for ${prop.kind} '${prop.name}'`)
  }
}

function getColumnSchema(prop: EntityProperty, columnType: string): z.ZodType {
  if (columnType.endsWith('[]')) {
    return z.array(getColumnSchema(prop, columnType.slice(0, -2)))
  }
  const length = columnType.match(/^(?:varchar|character varying)\((\d+)\)$/)
  if (length) return z.string().max(Number(length[1]))
  switch (columnType) {
    case 'int':
    case 'integer':
    case 'smallint':
      return z.number().int()
    case 'double precision':
    case 'real':
      return z.number()
    case 'boolean':
      return z.boolean()
    case 'text':
      return z.string()
    case 'timestamptz':
    case 'timestamp':
      return z.coerce.date()
    default:
      throw new Error(
        `No write schema for column type '${columnType}' of '${prop.name}'`
      )
  }
}

const isJson = (prop: EntityProperty) => (
  prop.kind === ReferenceKind.SCALAR && /^jsonb?$/.test(prop.columnTypes[0]!)
)

function asSent(schema: z.ZodType) {
  return z
    .unknown()
    .superRefine((value, ctx) =>
      forwardIssues(schema.safeParse(value), ctx, value)
    )
}

// Adds the issues of a nested check to the current value, at their paths.
function forwardIssues(
  result: z.ZodSafeParseResult<unknown>,
  ctx: z.RefinementCtx,
  input: unknown
) {
  for (const issue of result.error?.issues ?? []) {
    ctx.addIssue({ ...issue, code: 'custom', input })
  }
}

const nullable = (prop: EntityProperty, schema: z.ZodType) =>
  prop.nullable ? schema.nullable() : schema

const isRequired = (prop: EntityProperty) => (
  !prop.nullable &&
  prop.default === undefined &&
  prop.defaultRaw === undefined &&
  isColumn(prop)
)

// A scalar or the foreign key of a relation to one row.
export const isColumn = (prop: EntityProperty) => (
  prop.kind === ReferenceKind.SCALAR ||
  prop.kind === ReferenceKind.MANY_TO_ONE
)

// `em.assign()` matches nested rows by id, and would move a row of another
// parent into this one. Checks along every owned relation that each id in
// `data` belongs to a row of `entity`. Loads the owned rows that aren't yet.
export async function checkOwnedIds(
  entity: Record<string, any>,
  meta: EntityMetadata,
  data: Record<string, unknown>,
  path: FieldError['path'] = []
) {
  for (const prop of meta.props) {
    const rows = getOwnedRows(prop, data[prop.name])
    if (!rows.length) continue
    const key = prop.targetMeta!.primaryKeys[0]!
    const collection = entity[prop.name]
    if (!collection.isInitialized()) await collection.init()
    const byId = new Map<unknown, Record<string, any>>(
      collection.getItems().map((row: Record<string, any>) => [row[key], row])
    )
    for (const [index, row] of rows.entries()) {
      if (row[key] === undefined) continue
      const rowPath = [...path, prop.name, index]
      const match = byId.get(row[key])
      if (!match) {
        throw createValidationError([
          {
            path: [...rowPath, key],
            message: `is not a row of this ${meta.className}`
          }
        ])
      }
      await checkOwnedIds(match, prop.targetMeta!, row, rowPath)
    }
  }
}
