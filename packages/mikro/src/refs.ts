import { isArray, isPlainObject, isString } from '@ditojs/utils'
import {
  ReferenceKind,
  type EntityMetadata,
  type EntityProperty
} from '@mikro-orm/core'
import { createValidationError, type FieldError } from './errors.ts'

// Dito's admin sends a new row of a graph with `#id`, and a relation to it from
// elsewhere in the graph as `{ '#ref': <the same key> }`, since the row has no
// id yet. `takeRefs()` takes both out of the data before it is assigned. The
// function it returns sets each relation to the entity of its `#id`, once the
// assign has created the entities.

type Row = Record<string, unknown>

interface Ref {
  holder: Row
  prop: string
  key: string
  path: FieldError['path']
}

const isRef = (value: unknown): value is { '#ref': string } => (
  isPlainObject(value) && isString(value['#ref'])
)

// The rows of an owned relation: one-to-many with `orphanRemoval`.
export function getOwnedRows(prop: EntityProperty, value: unknown) {
  return (
    prop.kind === ReferenceKind.ONE_TO_MANY &&
    prop.orphanRemoval &&
    isArray(value)
  )
    ? (value as Row[])
    : []
}

export function takeRefs(meta: EntityMetadata, data: Row) {
  const sources = new Map<string, Row>()
  const refs: Ref[] = []

  const take = (meta: EntityMetadata, row: Row, path: FieldError['path']) => {
    if (isString(row['#id'])) sources.set(row['#id'] as string, row)
    delete row['#id']
    for (const prop of meta.props) {
      const value = row[prop.name]
      if (prop.kind === ReferenceKind.MANY_TO_ONE && isRef(value)) {
        refs.push({
          holder: row,
          prop: prop.name,
          key: value['#ref'],
          path: [...path, prop.name]
        })
        delete row[prop.name]
      }
      getOwnedRows(prop, value).forEach((child, index) =>
        take(prop.targetMeta!, child, [...path, prop.name, index])
      )
    }
  }
  take(meta, data, [])

  return function link(entity: object) {
    if (!refs.length) return
    // `em.assign()` and `em.create()` keep the order of nested rows, so each
    // row of the data matches the entity at its index.
    const entities = new Map<Row, any>()
    const match = (meta: EntityMetadata, row: Row, entity: any) => {
      entities.set(row, entity)
      for (const prop of meta.props) {
        const rows = getOwnedRows(prop, row[prop.name])
        if (!rows.length) continue
        const items = entity[prop.name].getItems()
        rows.forEach((child, index) =>
          match(prop.targetMeta!, child, items[index])
        )
      }
    }
    match(meta, data, entity)
    for (const { holder, prop, key, path } of refs) {
      const source = sources.get(key)
      if (!source) {
        throw createValidationError([
          { path, message: `references the unknown new row '${key}'` }
        ])
      }
      entities.get(holder)[prop] = entities.get(source)
    }
  }
}
