import { isArray, isPlainObject, isString } from '@ditojs/utils'
import {
  EntitySchema,
  Reference,
  ReferenceKind,
  Utils,
  type EntityMetadata,
  type EntityProperty
} from '@mikro-orm/core'

// What Dito reads from MikroORM's metadata. An owned relation holds the nested
// rows that a write sends with their parent: a one-to-many relation, or the
// inverse side of a one-to-one relation, with `orphanRemoval`.

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

export const isOwned = (prop: EntityProperty) => (
  !!prop.orphanRemoval && (
    prop.kind === ReferenceKind.ONE_TO_MANY ||
    (prop.kind === ReferenceKind.ONE_TO_ONE && !prop.owner)
  )
)

export type Row = Record<string, any>

// The rows of an owned relation in a body: the items of an array, or the row
// of a one-to-one relation.
export function getOwnedRows(prop: EntityProperty, value: unknown): Row[] {
  if (!isOwned(prop)) return []
  return isArray(value) ? value : isPlainObject(value) ? [value] : []
}

// The loaded entities of a relation of `entity`.
export function getLoaded(entity: Row, prop: EntityProperty): Row[] {
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

// Whether a list loads the column of the property.
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
  if (primaryKeys.length !== 1) {
    throw new Error(
      `'${className}' has ${primaryKeys.length ? 'a composite' : 'no'} ` +
      'primary key: Dito only supports entities with a single primary key'
    )
  }
  return meta.getPrimaryProp()
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

// Converts an id for the primary key `prop`, from the string of a path or a
// value of a body. Returns undefined for an id that doesn't fit, which the
// controller responds to with 404 or 400. Integers come as numbers or strings
// of digits, since JSON numbers lose digits past 2^53, and are returned as the
// runtime type of the property.
export function toPrimaryKey(prop: EntityProperty, id: unknown): unknown {
  const column = prop.columnTypes?.[0] ?? ''
  const bits = integerBits[column]
  if (bits) {
    const isInteger = (
      Number.isSafeInteger(id) ||
      (isString(id) && /^-?\d+$/.test(id))
    )
    if (!isInteger) return undefined
    const integer = BigInt(id as number | string)
    const max = 2n ** (bits - 1n)
    if (integer < -max || integer >= max) return undefined
    const type = prop.runtimeType
    return type === 'bigint'
      ? integer
      : type === 'string'
        ? String(integer)
        : Number(integer)
  }
  if (!isString(id) || id === '') return undefined
  if (column === 'uuid') {
    // Postgres returns UUIDs in lower case.
    return uuidPattern.test(id) ? id.toLowerCase() : undefined
  }
  return id
}
