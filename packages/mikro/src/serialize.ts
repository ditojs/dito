import { ProblemError } from '@ditojs/server-next'
import {
  ReferenceKind,
  serialize,
  type EntityMetadata,
  type EntityProperty
} from '@mikro-orm/core'

// Rows as Dito returns them, through MikroORM's `serialize()`: the relations
// of `populate` as nested rows, other relations to one row as `{ id }`, and
// no relation to many rows that `populate` leaves out, even when a handler
// loaded it. A nested row leaves out the relation back to its parent, which
// the nesting already shows. `fields` narrows the properties, and keeps the
// primary key of each row.

interface Tree {
  [name: string]: Tree
}

export interface OutputOptions {
  populate: string[]
  exclude: string[]
  fields: string[] | undefined
}

export function getOutputOptions(
  meta: EntityMetadata,
  {
    populate = [],
    exclude = [],
    fields
  }: { populate?: string[]; exclude?: string[]; fields?: string[] }
): OutputOptions {
  const tree = toTree(populate)
  const excluded = [...exclude]
  const visit = (
    meta: EntityMetadata,
    node: Tree,
    prefix: string,
    parent?: string
  ) => {
    for (const prop of meta.props) {
      const path = `${prefix}${prop.name}`
      const child = node[prop.name]
      if (prop.name === parent) {
        excluded.push(path)
      } else if (child) {
        visit(
          prop.targetMeta!,
          child,
          `${path}.`,
          prop.kind === ReferenceKind.ONE_TO_MANY ? prop.mappedBy : undefined
        )
      } else if (isToMany(prop)) {
        excluded.push(path)
      }
    }
  }
  visit(meta, tree, '')
  return {
    populate,
    exclude: excluded,
    fields: fields && withPrimaryKeys(meta, fields)
  }
}

export function serializeRow(row: object, options: OutputOptions) {
  return serialize(row, { ...(options as any), forceObject: true })
}

// Checks that the `fields` of a request narrow `allowed`, or, without
// `allowed`, the properties of the entity and its populated relations.
export function narrowFields(
  meta: EntityMetadata,
  requested: string[],
  { populate = [], fields: allowed }: { populate?: string[]; fields?: string[] }
) {
  const tree = toTree(populate)
  for (const field of requested) {
    const valid = allowed
      ? allowed.some(
          path => (
            path === '*' ||
            field === path ||
            field.startsWith(`${path.replace(/\.\*$/, '')}.`)
          )
        )
      : isPopulatedPath(meta, tree, field.split('.'))
    if (!valid) {
      throw new ProblemError({
        status: 400,
        detail: `Invalid field '${field}'`
      })
    }
  }
  return requested
}

function isPopulatedPath(
  meta: EntityMetadata,
  node: Tree,
  [name, ...rest]: string[]
): boolean {
  const prop = meta.properties[name as never] as EntityProperty | undefined
  if (!prop) return false
  if (!rest.length) return true
  const child = node[name!]
  return !!child && isPopulatedPath(prop.targetMeta!, child, rest)
}

function withPrimaryKeys(meta: EntityMetadata, fields: string[]) {
  const paths = new Set<string>(meta.primaryKeys)
  for (const field of fields) {
    paths.add(field)
    let current = meta
    const segments = field.split('.')
    for (const [index, segment] of segments.slice(0, -1).entries()) {
      const prop = current.properties[segment as never] as EntityProperty
      if (!prop?.targetMeta) break
      current = prop.targetMeta
      const prefix = segments.slice(0, index + 1).join('.')
      for (const key of current.primaryKeys) paths.add(`${prefix}.${key}`)
    }
  }
  return [...paths]
}

function toTree(paths: string[]) {
  const tree: Tree = {}
  for (const path of paths) {
    let node = tree
    // Skips hints such as `:ref` and `*`.
    for (const segment of path.split(':')[0]!.split('.')) {
      if (segment === '*' || segment === '$infer') break
      node = node[segment] ??= {}
    }
  }
  return tree
}

const isToMany = (prop: EntityProperty) => (
  prop.kind === ReferenceKind.ONE_TO_MANY ||
  prop.kind === ReferenceKind.MANY_TO_MANY
)
