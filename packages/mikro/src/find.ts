import type { DitoContext, RequestContext } from '@ditojs/server'
import { isFunction, isPlainObject } from '@ditojs/utils'
import {
  ReferenceKind,
  type EntityMetadata,
  type EntityProperty,
  type FindOptions
} from '@mikro-orm/core'
import {
  getPathProps,
  getProperty,
  isLoadedColumn,
  isOwningToOne,
  isRelation
} from './metadata.ts'

export interface FindShape<T extends object = any>
  extends FindOptions<T, any, any, any> {
  where?: object
  // 1000 by default, or `Infinity` for no limit, such as for the options of a
  // select. Only lists read it.
  maxRows?: number
}

export type Find<T extends object = any> =
  | FindShape<T>
  | ((context: RequestContext) => FindShape<T> | Promise<FindShape<T>>)

// The options that the base sets itself.
const controlled = ['limit', 'offset', 'ctx', 'disableIdentityMap', 'lockMode']

export function checkFind<T extends object>(find: FindShape<T>) {
  for (const key of controlled) {
    if (key in find) {
      throw new Error(
        `Unable to set \`${key}\` in \`find\`, which the base controls`
      )
    }
  }
  return find
}

export async function resolveFind<T extends object>(
  find: Find<T>,
  c: DitoContext
) {
  return isFunction(find) ? checkFind(await find({ ...c.var, c })) : find
}

// MikroORM can't take `fields` and `exclude` together, so `fields` wins.
export function splitFind<T extends object>(
  meta: EntityMetadata<T>,
  find: FindShape<T>
) {
  const { where = {}, maxRows, ...options } = find
  const fields = options.fields as string[] | undefined
  if (fields) {
    delete options.exclude
    options.fields = getLoadedFields(meta, fields) as never
  }
  return { where, options: options as FindOptions<T, any, any, any> }
}

// `fields` decides what goes out. The controller's row loads all its columns
// that aren't lazy, so that its getters can read them. A related row loads the
// columns that `fields` names, or all of them for `*` or one of its getters.
// Formulas cost a subquery each, so they load only where `fields` names them.
// `*` and getters name the formulas of their row that aren't lazy.
function getLoadedFields(meta: EntityMetadata, fields: string[]) {
  const loaded = new Set<string>()
  for (const field of fields) {
    const props = getPathProps(meta, field)
    const name = field.split('.').at(-1)!
    const prefix = field.slice(0, -name.length)
    const target = props.length ? props.at(-1)!.targetMeta : meta
    // Other paths, such as those into embedded objects, load as they are:
    const isRowPath = (
      props.every(isRelation) &&
      prefix === props.map(prop => `${prop.name}.`).join('')
    )
    if (target && isRowPath) {
      const prop = getProperty(target, name)
      const loadsFormulas = name === '*' || (!!prop && isGetter(prop))
      const loadsColumns = !prefix || loadsFormulas
      for (const column of target.props) {
        if (
          (loadsColumns && isRowColumn(column)) ||
          (loadsFormulas && column.formula && !column.lazy)
        ) {
          loaded.add(prefix + column.name)
        }
      }
      if (!loadsFormulas) loaded.add(field)
    } else {
      loaded.add(field)
    }
  }
  return [...loaded]
}

const isGetter = (prop: EntityProperty) => (
  prop.persist === false && !prop.formula
)

const isRowColumn = (prop: EntityProperty) => (
  isLoadedColumn(prop) &&
  !prop.formula &&
  !prop.embedded && (
    prop.kind === ReferenceKind.SCALAR ||
    prop.kind === ReferenceKind.EMBEDDED ||
    isOwningToOne(prop)
  )
)

// The options of `extra` replace those of `base`, but the `where`s join with
// `$and`, and `filters` merge by name:
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
  // `extra` with `fields` names its own `populate`, so that a list of choices
  // loads no relations that it doesn't send:
  if (extra.fields && !extra.populate) delete merged.populate
  return merged as FindShape<T>
}
