import { createValidationError, type ValidationIssue } from '@ditojs/server'
import { mapConcurrently } from '@ditojs/utils'
import {
  ReferenceKind,
  wrap,
  type EntityMetadata,
  type EntityName,
  type EntityProperty
} from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/sql'
import {
  checkRefs,
  clean,
  getRowKey,
  getWritableProps,
  type BodyCheck,
  type Path,
  type RelationId
} from './bodyCheck.ts'
import { getType, isRequired } from './columnSchema.ts'
import {
  getLoadedRows,
  getOwnedRows,
  getPrimaryKey,
  isOwned,
  isOwningToOne,
  isToMany,
  type Row
} from './metadata.ts'

// The writes of the default `post` and `patch :id`, also for custom handlers.

// Neither write flushes, so handlers can work on the entities first.
export async function createRecord<T extends object>(
  em: EntityManager,
  entity: EntityName<T>,
  data: unknown
): Promise<T> {
  const meta = em.getMetadata().get(entity)
  const check = await clean(meta, data)
  matchRows(meta, check)
  await checkIds(em, check.ids)
  const record = em.create(entity, check.row as never)
  setRefs(meta, check, record)
  return record
}

// Assign `data` as a PATCH: the fields that `data` sends change, and its arrays
// of owned rows are the full set.
export async function assignRecord<T extends object>(
  em: EntityManager,
  record: T,
  data: unknown
): Promise<T> {
  const meta = wrap(record, true).__meta
  const check = await clean(meta, data)
  const { row } = check
  // Load the owned rows to match them by id, and the many-to-many collections,
  // which MikroORM else writes as new pivot rows, losing their other columns:
  const paths = [...check.populate]
  if (paths.length) await em.populate(record, paths as never)
  const records = matchRows(meta, check, record)
  // Ids that the record already links need no check.
  const isLinked = createIsLinked(records)
  await checkIds(
    em,
    check.ids.filter(id => !isLinked(id))
  )
  em.assign(record, row as never, { onlyProperties: true })
  setRefs(meta, check, record)
  return record
}

// Match the owned rows to the loaded rows of `record` by their keys, at any
// depth: `em.assign()` matches by id alone, and would move a row of another
// record into this one. A row that matches none is new, as are all rows of a
// create. Then run the checks that depend on which rows are new.
function matchRows(meta: EntityMetadata, check: BodyCheck, record?: object) {
  const records = new Map<Row, Row>()
  const match = (
    meta: EntityMetadata,
    row: Row,
    record: Row | undefined,
    path: Path,
    parent?: string
  ) => {
    if (record) records.set(row, record)
    const keyPath = check.keyPaths.get(row)
    if (keyPath) {
      const message = record
        ? 'is not allowed in a row with an id'
        : !path.length
          ? 'is only allowed in nested rows'
          : undefined
      if (message) check.addIssue(message, keyPath)
    }
    if (!record) {
      // The nesting sets the relation back to the parent row, and a ref stays
      // out of the row until `setRefs()`.
      const isSet = (prop: EntityProperty) => (
        row[prop.name] !== undefined ||
        check.refs.some(ref => ref.row === row && ref.prop === prop)
      )
      for (const prop of getWritableProps(meta).filter(isRequired)) {
        if (prop.name !== parent && !isSet(prop)) {
          check.addTypeIssue(getType(prop), undefined, [...path, prop.name])
        }
      }
    }
    for (const prop of meta.props) {
      if (!isOwned(prop) || row[prop.name] == null) continue
      const target = prop.targetMeta!
      const key = getRowKey(prop)
      const isPivot = isOwningToOne(key)
      const getKey = (item: Row) =>
        isPivot ? wrap(item[key.name], true).getPrimaryKey() : item[key.name]
      const loaded = record ? getLoadedRows(record, prop) : []
      const existing = new Map(loaded.map(item => [getKey(item), item]))
      const isMany = prop.kind === ReferenceKind.ONE_TO_MANY
      const children = getOwnedRows(prop, row[prop.name])
      for (const [index, child] of children.entries()) {
        // A row that `cleanRow()` refused is an issue already.
        if (!child) continue
        const childPath = [...path, prop.name, ...(isMany ? [index] : [])]
        const id = child[key.name]
        const found = id == null ? undefined : existing.get(id)
        // MikroORM finds a pivot row by both of its keys.
        if (isPivot && record) {
          child[prop.mappedBy] = wrap(record, true).getPrimaryKey()
        }
        if (!found && id != null && !isPivot) {
          const message = record
            ? `is not a row of this ${meta.className}`
            : 'is not allowed in a new row'
          check.addIssue(message, [...childPath, key.name])
        }
        // A new pair is keyed by a stored row, and holds no refs.
        if (!found && isPivot) {
          for (const ref of check.refs) {
            if (ref.row === child) {
              check.addIssue('is not allowed to reference a new row', ref.path)
            }
          }
        }
        match(target, child, found, childPath, prop.mappedBy)
      }
    }
  }
  match(meta, check.row, record as Row | undefined, [])
  checkRefs(check)
  if (check.issues.length) throw createValidationError(check.issues)
  return records
}

// Keep the linked ids of each relation, by the relation's value:
function createIsLinked(records: Map<Row, Row>) {
  const linked = new Map<unknown, Set<string>>()
  return ({ row, prop, id }: RelationId) => {
    const record = records.get(row) ?? {}
    const value = record[prop.name]
    let ids = linked.get(value)
    if (!ids) {
      ids = new Set(
        getLoadedRows(record, prop).map(item =>
          String(wrap(item, true).getPrimaryKey())
        )
      )
      linked.set(value, ids)
    }
    return ids.has(String(id))
  }
}

// A relation set by id would link any row with that id, so check that each id
// names a row that MikroORM's default filters let through, such as one that
// isn't soft deleted, with one query per target entity.
async function checkIds(em: EntityManager, ids: RelationId[]) {
  const byTarget = Map.groupBy(ids, ({ prop }) => prop.targetMeta!)
  const issues: ValidationIssue[] = []
  await mapConcurrently([...byTarget], async ([target, items]) => {
    const key = getPrimaryKey(target).name
    // Skip the identity map, since rows loaded with their ids only would go
    // out that way in the response of the write.
    const rows: Row[] = await em.find(
      target.class,
      { [key]: { $in: [...new Set(items.map(({ id }) => id))] } },
      { fields: [key] as never[], disableIdentityMap: true }
    )
    const found = new Set(rows.map(row => String(row[key])))
    for (const { id, path } of items) {
      if (!found.has(String(id))) {
        issues.push({
          path,
          code: 'invalid_value',
          message: `names no ${target.className}`
        })
      }
    }
  })
  if (issues.length) throw createValidationError(issues)
}

// Set the refs once MikroORM created the graph, which also orders the inserts:
function setRefs(meta: EntityMetadata, check: BodyCheck, record: object) {
  if (!check.refs.length) return
  const entities = getEntities(meta, check.row, record as Row)
  for (const { key, row, prop } of check.refs) {
    const entity = entities.get(check.newRowsByKey.get(key)!.row)
    const holder = entities.get(row)!
    if (isToMany(prop)) holder[prop.name].add(entity)
    else holder[prop.name] = entity
  }
}

// The entity of each row of a body. Owned rows keep their order in the record.
function getEntities(
  meta: EntityMetadata,
  row: Row,
  entity: Row,
  entities = new Map<Row, Row>()
) {
  entities.set(row, entity)
  for (const prop of meta.props) {
    if (isOwned(prop) && row[prop.name] != null) {
      const loaded = getLoadedRows(entity, prop)
      for (const [index, child] of getOwnedRows(
        prop,
        row[prop.name]
      ).entries()) {
        getEntities(prop.targetMeta!, child, loaded[index]!, entities)
      }
    }
  }
  return entities
}
