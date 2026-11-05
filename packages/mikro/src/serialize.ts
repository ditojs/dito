import { isArray, isPlainObject, mapConcurrently } from '@ditojs/utils'
import {
  Reference,
  Utils,
  serialize,
  wrap,
  type EntityMetadata
} from '@mikro-orm/core'
import type { FindShape } from './find.ts'
import {
  getLoaded,
  getPathProps,
  isOwningToOne,
  isRelation,
  isToMany,
  type Row
} from './metadata.ts'

// Rows go out through MikroORM's `serialize()`, never through `toJSON()`.
// Records of a controller go out in the shape of its `find`: `fields` and
// `exclude` as `serialize()` applies them, and the relations of `populate` and
// of the paths in `fields`, such as `author.name`, as nested rows. Other
// relations to one row that hold the foreign key go out as `{ id }`, or `null`.
// Other relations don't go out, even when a handler loaded them. Other entities
// go out with the relations that are loaded.

// The options of `serialize()`.
export type Output = Record<string, unknown>

export function getOutput(meta: EntityMetadata, shape: FindShape): Output {
  const {
    populate: paths = [],
    exclude = [],
    fields
  } = shape as {
    populate?: string[]
    exclude?: string[]
    fields?: string[]
  }
  // MikroORM populates the relations of the paths in `fields`.
  const populate = [...paths, ...(fields ? getRelationPaths(meta, fields) : [])]
  return {
    populate,
    exclude: [...exclude, ...getLeftOut(meta, populate)],
    fields: fields && toFields(meta, fields),
    forceObject: true
  }
}

// The paths of the relations that stay out of the response: relations to many
// rows and inverse one-to-one relations that `populate` doesn't name, also in
// the rows that it names. `serialize()` would send their ids once they are
// loaded.
function getLeftOut(
  meta: EntityMetadata,
  populate: string[],
  prefix = ''
): string[] {
  return meta.relations.flatMap(prop => {
    const path = `${prefix}${prop.name}`
    return populate.some(item => isSamePath(item, path))
      ? getLeftOut(prop.targetMeta!, populate, `${path}.`)
      : isOwningToOne(prop)
        ? []
        : [path]
  })
}

// Whether the path of `populate`, without a hint such as `:ref`, is `path` or
// a path below it.
const isSamePath = (item: string, path: string) =>
  `${item.split(':')[0]}.`.startsWith(`${path}.`)

// The relations of the paths in `fields`: `author` of `author.name`.
function getRelationPaths(meta: EntityMetadata, fields: string[]) {
  return fields.flatMap(field => {
    const props = getPathProps(meta, field)
    const end = props.findIndex(prop => !isRelation(prop))
    const names = props.slice(0, end < 0 ? undefined : end).map(p => p.name)
    return names.length ? [names.join('.')] : []
  })
}

// The `fields` of `serialize()`: each row keeps its primary key.
function toFields(meta: EntityMetadata, fields: string[]) {
  const paths = new Set(meta.primaryKeys)
  for (const field of fields) {
    paths.add(field)
    let prefix = ''
    for (const prop of getPathProps(meta, field)) {
      prefix += `${prop.name}.`
      for (const key of prop.targetMeta?.primaryKeys ?? []) {
        paths.add(prefix + key)
      }
    }
  }
  return [...paths]
}

// The output of entities that no controller's `find` shapes, once per entity.
const plainOutputs = new WeakMap<EntityMetadata, Output>()

function getPlainOutput(meta: EntityMetadata) {
  let output = plainOutputs.get(meta)
  if (!output) {
    output = getOutput(meta, {})
    plainOutputs.set(meta, output)
  }
  return output
}

// Serializes the entities in a result, also in arrays and plain objects.
// Records that `isRecord` accepts go through `serializeRecord`.
export function serializeResult(
  value: unknown,
  isRecord: (value: unknown) => boolean,
  serializeRecord: (record: object) => unknown
): Promise<unknown> {
  const convert = async (
    value: unknown,
    ancestors: Set<object>
  ): Promise<unknown> => {
    if (isRecord(value)) return serializeRecord(value as object)
    if (isArray(value)) {
      return mapConcurrently(value, item => convert(item, ancestors))
    }
    if (isPlainObject(value)) {
      const entries = await mapConcurrently(
        Object.entries(value),
        async ([key, item]) => [key, await convert(item, ancestors)] as const
      )
      return Object.fromEntries(entries)
    }
    return Utils.isEntity(value)
      ? serializeEntity(value as Row, ancestors)
      : value
  }

  // An entity with its loaded relations. A relation that leads back to an
  // entity above it stays `{ id }`, or is left out if it holds many rows.
  const serializeEntity = async (entity: Row, ancestors: Set<object>) => {
    const { __meta: meta } = wrap(entity, true)
    const json: Row = serialize(entity, getPlainOutput(meta))
    const nested = new Set([...ancestors, entity])
    for (const prop of meta.relations) {
      const value = entity[prop.name]
      const isLoaded = Utils.isCollection(value)
        ? value.isInitialized()
        : value != null &&
          wrap(Reference.unwrapReference(value), true).isInitialized()
      const items = getLoaded(entity, prop)
      if (isLoaded && !items.some(item => nested.has(item))) {
        const values = await mapConcurrently(items, item =>
          convert(item, nested)
        )
        json[prop.name] = isToMany(prop) ? values : values[0]
      }
    }
    return json
  }

  return convert(value, new Set())
}
