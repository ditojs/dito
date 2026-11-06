import { isArray, isPlainObject, isString } from '@ditojs/utils'
import {
  EntitySchema,
  Reference,
  ReferenceKind,
  Utils,
  type EntityMetadata,
  type EntityProperty
} from '@mikro-orm/core'

export const isRelation = (prop: EntityProperty) => (
  prop.kind !== ReferenceKind.SCALAR && prop.kind !== ReferenceKind.EMBEDDED
)

export const isToMany = (prop: EntityProperty) => (
  prop.kind === ReferenceKind.ONE_TO_MANY ||
  prop.kind === ReferenceKind.MANY_TO_MANY
)

export const isOwningToOne = (prop: EntityProperty) => (
  prop.kind === ReferenceKind.MANY_TO_ONE ||
  (prop.kind === ReferenceKind.ONE_TO_ONE && !!prop.owner)
)

// An owned relation holds the nested rows that a write sends with their parent:
export const isOwned = (prop: EntityProperty) => (
  !!prop.orphanRemoval && (
    prop.kind === ReferenceKind.ONE_TO_MANY ||
    (prop.kind === ReferenceKind.ONE_TO_ONE && !prop.owner)
  )
)

export type Row = Record<string, any>

// In a body, an owned relation holds an array of rows or a single one.
export function getOwnedRows(prop: EntityProperty, value: unknown): Row[] {
  if (!isOwned(prop)) return []
  return isArray(value) ? value : isPlainObject(value) ? [value] : []
}

export function getLoadedRows(entity: Row, prop: EntityProperty): Row[] {
  const value = entity[prop.name]
  if (Utils.isCollection(value)) {
    return value.isInitialized() ? (value.getItems(false) as Row[]) : []
  }
  return value ? [Reference.unwrapReference(value)] : []
}

// Leaves out what else a module of entities exports.
export const getEntities = (entities: object) =>
  isArray(entities) ? entities : Object.values(entities).filter(isEntity)

const isEntity = (value: unknown) => (
  value instanceof EntitySchema || EntitySchema.REGISTRY.has(value as never)
)

// Lists load the columns that aren't lazy:
export const isLoadedColumn = (prop: EntityProperty) => (
  !prop.lazy && (prop.persist !== false || !!prop.formula)
)

export function getProperty(meta: EntityMetadata | undefined, name: string) {
  return meta?.properties[name as never] as EntityProperty | undefined
}

// The properties that lead to the last segment of a dotted path, such as
// `author` of `author.name`, up to the first segment that isn't a property.
export function getPathProps(meta: EntityMetadata, path: string) {
  const props: EntityProperty[] = []
  let current: EntityMetadata | undefined = meta
  for (const segment of path.split('.').slice(0, -1)) {
    const prop = getProperty(current, segment)
    if (!prop) break
    props.push(prop)
    current = prop.targetMeta
  }
  return props
}

export function getPrimaryKey(meta: EntityMetadata): EntityProperty {
  const { primaryKeys, className } = meta
  if (primaryKeys.length === 1) {
    return meta.getPrimaryProp()
  } else {
    throw new Error(
      `Unsupported ${primaryKeys.length ? 'composite' : 'missing'} primary ` +
      `key of '${className}': Dito only supports entities with a single ` +
      'primary key'
    )
  }
}

// The bits of Postgres' integer column types.
export const integerBits: Record<string, bigint> = {
  smallint: 16n,
  int2: 16n,
  int: 32n,
  integer: 32n,
  int4: 32n,
  serial: 32n,
  bigint: 64n,
  int8: 64n,
  bigserial: 64n
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Convert the id of a path or a body to the runtime type of the key, or to
// undefined if it doesn't fit, for the controller to respond with 404 or 400.
export function toPrimaryKey(prop: EntityProperty, id: unknown): unknown {
  const column = prop.columnTypes?.[0] ?? ''
  const bits = integerBits[column]
  if (bits) {
    // JSON numbers lose digits past 2^53, so integers also come as strings:
    const isInteger = (
      Number.isSafeInteger(id) ||
      (isString(id) && /^-?\d+$/.test(id))
    )
    const integer = isInteger ? BigInt(id as number | string) : undefined
    const max = 2n ** (bits - 1n)
    if (integer !== undefined && integer >= -max && integer < max) {
      const type = prop.runtimeType
      return type === 'bigint'
        ? integer
        : type === 'string'
          ? String(integer)
          : Number(integer)
    }
  } else if (column === 'uuid') {
    // Postgres returns UUIDs in lower case.
    return isString(id) && uuidPattern.test(id) ? id.toLowerCase() : undefined
  } else if (isString(id) && id !== '') {
    return id
  }
  return undefined
}
