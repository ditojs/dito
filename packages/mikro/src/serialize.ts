import { isArray, isPlainObject, mapConcurrently } from '@ditojs/utils'
import {
  Reference,
  ReferenceKind,
  SerializationContext,
  Utils,
  serialize,
  wrap,
  type EntityMetadata
} from '@mikro-orm/core'
import type { FindShape } from './find.ts'
import {
  getLoadedRows,
  getPathProps,
  isOwningToOne,
  isRelation,
  isToMany,
  type Row
} from './metadata.ts'

// Rows go out through MikroORM's `serialize()`, never through `toJSON()`.

// The options of `serialize()`.
export type Output = Record<string, unknown>

const outputsByMeta = new WeakMap<EntityMetadata, WeakMap<object, Output>>()

// Records go out in the shape of their controller's `find`, with the relations
// of `populate` and of the paths in `fields`, such as `author.name`, as nested
// rows.
export function getOutput(meta: EntityMetadata, shape: FindShape): Output {
  let outputs = outputsByMeta.get(meta)
  if (!outputs) {
    outputs = new WeakMap()
    outputsByMeta.set(meta, outputs)
  }
  let output = outputs.get(shape)
  if (!output) {
    output = createOutput(meta, shape)
    outputs.set(shape, output)
  }
  return output
}

function createOutput(meta: EntityMetadata, shape: FindShape): Output {
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

// Other relations go out as `{ id }` or `null` if they hold the foreign key,
// and else not at all, as `serialize()` would send their ids once a handler
// loaded them.
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

// Leave out hints such as `:ref`, and match paths below `path` too:
const isSamePath = (item: string, path: string) =>
  `${item.split(':')[0]}.`.startsWith(`${path}.`)

function getRelationPaths(meta: EntityMetadata, fields: string[]) {
  return fields.flatMap(field => {
    const props = getPathProps(meta, field)
    const end = props.findIndex(prop => !isRelation(prop))
    const names = props
      .slice(0, end < 0 ? undefined : end)
      .map(prop => prop.name)
    return names.length ? [names.join('.')] : []
  })
}

// Each row keeps its primary key:
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

// Entities that no controller's `find` shapes go out with their loaded
// relations:
const plainShape = {}

// `serialize()` walks all loaded relations of the entity it gets, and rows that
// share relations reach each other. One context walks them once for all rows.
export function serializeRows(rows: object[], output: Output) {
  const context = new SerializationContext()
  for (const row of rows) {
    SerializationContext.propagate(
      context,
      row,
      (meta, name) => meta.properties[name]?.kind !== ReferenceKind.SCALAR
    )
  }
  const items = rows.map(row => {
    const json = serialize(row, output)
    // Each row serializes like one on its own:
    context.visited.clear()
    return json
  })
  context.close()
  return items
}

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

  // A relation that leads back to an entity above it stays `{ id }`, or is left
  // out if it holds many rows.
  const serializeEntity = async (entity: Row, ancestors: Set<object>) => {
    const { __meta: meta } = wrap(entity, true)
    const json: Row = serialize(entity, getOutput(meta, plainShape))
    const nested = new Set([...ancestors, entity])
    for (const prop of meta.relations) {
      const value = entity[prop.name]
      const isLoaded = Utils.isCollection(value)
        ? value.isInitialized()
        : value != null &&
          wrap(Reference.unwrapReference(value), true).isInitialized()
      const items = getLoadedRows(entity, prop)
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
