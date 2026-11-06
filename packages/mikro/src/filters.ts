import { z } from 'zod'
import {
  HttpError,
  createValidationError,
  type DitoContext,
  type ValidationIssue
} from '@ditojs/server'
import { convertQueryValue, queryValidation } from '@ditojs/server/internal'
import { asArray, isEmpty, isString, mapConcurrently } from '@ditojs/utils'
import type { EntityManager } from '@mikro-orm/sql'
import type { ListQuery } from './listQuery.ts'
import { runSchema } from './validation.ts'

// `where` returns undefined to skip the filter.
export type FilterWhere<Value = any> = (context: {
  value: Value
  name: string
  c: DitoContext
  em: EntityManager
}) => object | undefined | Promise<object | undefined>

// A schema alone is short for `{ [name]: value }`.
export type Filter =
  | z.ZodType
  | { schema: z.ZodType; where: FilterWhere }

export function defineFilter<S extends z.ZodType>(filter: {
  schema: S
  where: FilterWhere<z.output<S>>
}): Filter {
  return filter
}

const operators = ['contains', 'equals', 'starts-with', 'ends-with'] as const

// The admin's `text` filter sends `filter=name:"text"`, or with operators
// `filter=name:"operator","text"`. Without properties, a filter applies to the
// property of its name.
export function defineTextFilter(properties: string[] = []): Filter {
  return {
    schema: z.union([
      z.string(),
      z.tuple([z.enum(operators).or(z.literal('')), z.string()])
    ]),
    where({ value, name }: { value: string | [string, string]; name: string }) {
      const [operator, text] = isString(value) ? ['', value] : value
      if (!text) return undefined
      const escaped = text.replace(/[\\%_]/g, '\\$&')
      const pattern =
        operator === 'equals'
          ? escaped
          : operator === 'starts-with'
            ? `${escaped}%`
            : operator === 'ends-with'
              ? `%${escaped}`
              : `%${escaped}%`
      return {
        $or: (properties.length ? properties : [name]).map(property => ({
          [property]: { $ilike: pattern }
        }))
      }
    }
  }
}

// The admin's `date-range` filter sends `filter=name:"from","to"`, either of
// which may be empty.
export function defineDateRangeFilter(property?: string): Filter {
  const date = z.iso.datetime({ offset: true }).or(z.literal(''))
  return {
    schema: z.union([date, z.tuple([date]), z.tuple([date, date])]),
    where({ value, name }: { value: string | string[]; name: string }) {
      const [from, to] = asArray(value)
      const range = {
        ...(from && { $gte: new Date(from) }),
        ...(to && { $lte: new Date(to) })
      }
      return isEmpty(range) ? undefined : { [property ?? name]: range }
    }
  }
}

// Convert each value by the schema of its filter, as query values are, and
// validate it. Several arguments give the schema an array.
export async function getFilterWheres(
  c: DitoContext,
  filters: Record<string, Filter>,
  values: ListQuery['filter']
): Promise<object[]> {
  const entries = values.map(({ name, value }) => {
    const filter = Object.hasOwn(filters, name) ? filters[name] : undefined
    if (!filter) {
      throw new HttpError(400, { message: `Unknown filter '${name}'` })
    }
    // Not `instanceof`, which fails with two copies of Zod.
    return 'safeParseAsync' in filter
      ? { name, value, schema: filter, where: toWhere }
      : { name, value, ...filter }
  })
  const issues: ValidationIssue[] = []
  const parsed = await mapConcurrently(entries, async entry => {
    const result = await runSchema(
      entry.schema,
      convertQueryValue(entry.schema, entry.value)
    )
    for (const issue of result.issues ?? []) {
      issues.push({ ...issue, path: [entry.name, ...(issue.path ?? [])] })
    }
    return { ...entry, value: result.issues ? undefined : result.value }
  })
  if (issues.length) {
    throw createValidationError(issues, {
      ...queryValidation,
      type: 'FilterValidation'
    })
  }
  const { em } = c.var
  const wheres = await mapConcurrently(parsed, ({ name, value, where }) =>
    where({ value, name, c, em })
  )
  return wheres.filter(where => where !== undefined)
}

// MikroORM reads `relation.id` as a nested `where`, not as a dotted key.
const toWhere: FilterWhere = ({ value, name }) =>
  name
    .split('.')
    .reduceRight<unknown>((where, key) => ({ [key]: where }), value) as object
