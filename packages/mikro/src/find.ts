import type { DitoContext, User } from '@ditojs/server'
import { isPlainObject } from '@ditojs/utils'
import {
  ReferenceKind,
  type EntityMetadata,
  type FindOptions
} from '@mikro-orm/core'
import { getPathProps, isLoadedColumn, isOwningToOne } from './metadata.ts'

// The `find` of a controller: MikroORM's find options, the `where` that every
// query applies, and the most rows that a list returns.

export interface FindShape<T extends object = any>
  extends FindOptions<T, any, any, any> {
  where?: object
  // 1000 by default, or `Infinity` for no limit, such as for the options of a
  // select. Only lists read it.
  maxRows?: number
}

export type Find<T extends object = any> =
  | FindShape<T>
  | ((context: {
      c: DitoContext
      user: User | null
    }) => FindShape<T> | Promise<FindShape<T>>)

// The options that the base sets itself.
const controlled = ['limit', 'offset', 'ctx', 'disableIdentityMap', 'lockMode']

export function checkFind<T extends object>(find: FindShape<T>) {
  for (const key of controlled) {
    if (key in find) {
      throw new Error(`\`find\` can't set \`${key}\`, which the base controls`)
    }
  }
  return find
}

// Splits a `find` into the `where` and the options of a query. MikroORM can't
// take `fields` and `exclude` together, so `fields` takes precedence.
export function splitFind<T extends object>(
  meta: EntityMetadata<T>,
  find: FindShape<T>
) {
  const { where = {}, maxRows, ...options } = find
  const fields = options.fields as string[] | undefined
  if (fields) {
    delete options.exclude
    options.fields = [
      ...new Set(fields.flatMap(path => expandWildcard(meta, path)))
    ] as never
  }
  return { where, options: options as FindOptions<T, any, any, any> }
}

// The columns of a relation that `relation.*` stands for. MikroORM selects all
// columns of `relation.*`, including the lazy ones and lazy formulas, whose
// subqueries can be slow. So Dito names the columns that aren't lazy. The `*`
// of the root entity selects no lazy formulas.
function expandWildcard(meta: EntityMetadata, path: string): string[] {
  if (!path.endsWith('.*')) return [path]
  const prefix = path.slice(0, -1)
  const props = getPathProps(meta, path)
  const target = props.at(-1)?.targetMeta
  // A path with a segment that isn't a property stays as it is.
  if (props.length !== path.split('.').length - 1 || !target) return [path]
  return target.props
    .filter(
      prop => (
        isLoadedColumn(prop) &&
        !prop.embedded && (
          prop.kind === ReferenceKind.SCALAR ||
          prop.kind === ReferenceKind.EMBEDDED ||
          isOwningToOne(prop)
        )
      )
    )
    .map(prop => prefix + prop.name)
}

// Merges `extra` into `base`: the options of `extra` replace those of `base`,
// except that the `where`s join with `$and` and `filters` merge by name.
// `extra` with `fields` names its own `populate`, so that a list of choices
// loads no more than it sends.
export function mergeFind<T extends object>(
  base: FindShape<T>,
  extra: FindShape<T>
): FindShape<T> {
  const merged: Record<string, any> = { ...base }
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) merged[key] = value
  }
  if (base.where && extra.where) {
    merged.where = { $and: [base.where, extra.where] }
  }
  if (isPlainObject(base.filters) && isPlainObject(extra.filters)) {
    merged.filters = { ...base.filters, ...extra.filters }
  }
  if (extra.fields && !extra.populate) delete merged.populate
  return merged as FindShape<T>
}
