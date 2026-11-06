import type { z } from 'zod'
import { createValidationError, type ValidationIssue } from '@ditojs/server'
import {
  isArray,
  isBoolean,
  isPlainObject,
  isString,
  mapConcurrently,
  parsePlainDate
} from '@ditojs/utils'
import {
  ArrayType,
  DecimalType,
  EnumArrayType,
  ReferenceKind,
  wrap,
  type EntityMetadata,
  type EntityName,
  type EntityProperty
} from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/sql'
import {
  getLoaded,
  getOwnedRows,
  getPrimaryKey,
  integerBits,
  isOwned,
  isOwningToOne,
  isToMany,
  toPrimaryKey,
  type Row
} from './metadata.ts'
import { runSchema } from './validation.ts'

// The writes of the controller's `post` and `patch :id`, also for custom
// handlers. `createRecord()` and `assignRecord()` keep the properties
// that a client may write, check the values that Postgres can't check well, and
// check that the ids of relations name rows. They don't flush, so a handler can
// work on the entities before the flush. Issues are collected at their path in
// the body, such as `chapters/2/sections/0/title`. In owned relations, a row
// with an id updates that row of the record, and a row without one is new.
//
// A new nested row has no id yet, so a body marks it with `#id`, and a relation
// to it is `{ '#ref': <the same key> }`. The new nested rows that carry `#id`
// or hold refs are created first, deepest first, each in its place in the data.
// The refs are set once the record is created or assigned.

type Path = (string | number)[]

// An id of a relation in the body, with the row that holds it.
interface RelationId {
  row: Row
  prop: EntityProperty
  id: unknown
  path: Path
}

// A `{ '#ref': key }` of the body, in the relation `prop` of `row`.
interface Ref {
  key: string
  row: Row
  prop: EntityProperty
  path: Path
}

// A new nested row that is created on its own. `place` puts its entity where
// the row is in the data.
interface NewRow {
  meta: EntityMetadata
  row: Row
  place?: (entity: object) => void
  entity?: object
}

export async function createRecord<T extends object>(
  em: EntityManager,
  entity: EntityName<T>,
  data: unknown
): Promise<T> {
  const meta = em.getMetadata().get(entity)
  const run = await clean(meta, data, true)
  await checkIds(em, run.ids)
  createNewRows(em, run)
  const record = em.create(entity, run.row as never)
  setRefs(run, row => (row === run.row ? record : undefined))
  return record
}

// Assigns `data` to `record`, as a PATCH: the fields that `data` sends change,
// and its arrays of owned rows are the full set.
export async function assignRecord<T extends object>(
  em: EntityManager,
  record: T,
  data: unknown
): Promise<T> {
  const meta = wrap(record, true).__meta
  const run = await clean(meta, data, false)
  const { row } = run
  // Owned rows are matched by id, so they need to be loaded. MikroORM writes
  // a many-to-many collection that isn't loaded as a new set of pivot rows,
  // and a loaded one as the pairs that change, which keeps the other columns
  // of the pivot rows.
  const paths = [...getPopulatePaths(meta, row)]
  if (paths.length) await em.populate(record, paths as never)
  const records = matchOwnedRows(meta, run, record)
  // Ids that the record already links need no check.
  const isLinked = getLinkCheck(records)
  await checkIds(
    em,
    run.ids.filter(id => !isLinked(id))
  )
  createNewRows(em, run)
  em.assign(record, row as never, { onlyProperties: true })
  setRefs(run, row => records.get(row))
  return record
}

// Keeps the writable properties of `data` and checks them. Throws a 400 with
// all issues.
async function clean(meta: EntityMetadata, data: unknown, isNew: boolean) {
  const run = new Run()
  run.row = run.cleanRow(meta, data, [], isNew)!
  await Promise.all(run.pending)
  checkRefs(run)
  if (run.issues.length) throw createValidationError(run.issues)
  return run
}

// One pass through a body. It keeps the checked values and collects the issues,
// and the ids, refs and new rows for the later steps.
class Run {
  row!: Row
  issues: ValidationIssue[] = []
  // The schemas, which run together.
  pending: Promise<void>[] = []
  ids: RelationId[] = []
  refs: Ref[] = []
  // The new rows that carry `#id`, by key.
  sources = new Map<string, NewRow>()
  // In the order of their creation: nested rows before their parents.
  newRows = new Map<Row, NewRow>()

  invalidValue(message: string, path: Path) {
    this.issues.push({ path, code: 'invalid_value', message })
  }

  invalidType(expected: string, value: unknown, path: Path) {
    const received =
      value === null ? 'null' : isArray(value) ? 'array' : typeof value
    this.issues.push({
      path,
      code: 'invalid_type',
      message: `Invalid input: expected ${expected}, received ${received}`
    })
  }

  invalidOption(items: unknown[], path: Path) {
    const options = items.map(item => JSON.stringify(item)).join('|')
    this.invalidValue(`Invalid option: expected one of ${options}`, path)
  }

  tooBig(expected: string, path: Path) {
    this.issues.push({
      path,
      code: 'too_big',
      message: `Too big: expected ${expected}`
    })
  }

  tooSmall(expected: string, path: Path) {
    this.issues.push({
      path,
      code: 'too_small',
      message: `Too small: expected ${expected}`
    })
  }

  // `parent` is the relation back to the row that nests this one, which the
  // nesting sets.
  cleanRow(
    meta: EntityMetadata,
    data: unknown,
    path: Path,
    isNew: boolean,
    parent?: string
  ) {
    if (!isPlainObject(data)) return this.invalidType('object', data, path)
    const row: Row = {}
    for (const prop of getWritableProps(meta)) {
      if (prop.name === parent) continue
      const value = data[prop.name]
      if (value !== undefined) {
        const valuePath = [...path, prop.name]
        const cleaned = this.cleanValue(row, prop, value, valuePath, isNew)
        if (cleaned !== undefined) row[prop.name] = cleaned
      } else if (isNew && isRequired(prop)) {
        this.invalidType(getType(prop), value, [...path, prop.name])
      }
    }
    // A many-to-many relation writes the same rows as the owned rows of its
    // pivot entity, and MikroORM would insert them twice.
    for (const prop of meta.props) {
      const owned = meta.props.find(
        other => isOwned(other) && other.targetMeta!.class === prop.pivotEntity
      )
      if (owned && row[prop.name] && row[owned.name]) {
        const message = `writes the same rows as '${owned.name}'`
        this.invalidValue(message, [...path, prop.name])
      }
    }
    const source =
      '#id' in data
        ? this.addSource(meta, row, data['#id'], path, isNew)
        : undefined
    const hasRefs = this.refs.some(ref => ref.row === row)
    if (source || (path.length && isNew && hasRefs)) {
      this.newRows.set(row, source ?? { meta, row })
    }
    return row
  }

  // Adds the row with `#id`, which needs to be a new nested row, and returns
  // it.
  addSource(
    meta: EntityMetadata,
    row: Row,
    key: unknown,
    path: Path,
    isNew: boolean
  ) {
    const keyPath = [...path, '#id']
    if (!isString(key)) return this.invalidType('string', key, keyPath)
    const message = !isNew
      ? 'is not allowed in a row with an id'
      : !path.length
        ? 'is only allowed in nested rows'
        : this.sources.has(key)
          ? `is the key of another new row '${key}'`
          : undefined
    if (message) return this.invalidValue(message, keyPath)
    const source = { meta, row }
    this.sources.set(key, source)
    return source
  }

  // The value of a property, or undefined if it stays out of the data.
  cleanValue(
    row: Row,
    prop: EntityProperty,
    value: unknown,
    path: Path,
    isNew: boolean
  ): unknown {
    if (isToMany(prop)) {
      if (!isArray(value)) return this.invalidType('array', value, path)
      const items: unknown[] = value.map((item, index) =>
        isOwned(prop)
          ? this.cleanOwnedRow(
              prop,
              item,
              [...path, index],
              isNew,
              entity => (items[index] = entity)
            )
          : this.cleanId(row, prop, item, [...path, index])
      )
      if (isOwned(prop)) {
        // Two rows with the same key would write the same row.
        const key = getRowKey(prop).name
        const ids = items.map(item => (item as Row | undefined)?.[key])
        ids.forEach((id, index) => {
          if (id != null && ids.indexOf(id) < index) {
            this.invalidValue('is the key of another row', [
              ...path,
              index,
              key
            ])
          }
        })
      }
      return isOwned(prop) ? items : items.filter(item => item !== undefined)
    }
    if (value === null) {
      // Null removes an owned row.
      return prop.nullable ? null : this.invalidType(getType(prop), null, path)
    }
    if (isOwned(prop)) {
      return this.cleanOwnedRow(
        prop,
        value,
        path,
        isNew,
        entity => (row[prop.name] = entity)
      )
    }
    return isOwningToOne(prop)
      ? this.cleanId(row, prop, value, path)
      : this.cleanScalar(prop, value, path)
  }

  // A nested row of an owned relation, which may carry `#id`. `place` puts
  // its entity into the data, if it is created on its own.
  cleanOwnedRow(
    prop: EntityProperty,
    value: unknown,
    path: Path,
    isParentNew: boolean,
    place: (entity: object) => void
  ) {
    const target = prop.targetMeta!
    const key = getRowKey(prop)
    if (isPlainObject(value) && '#ref' in value) {
      return this.invalidValue('is not allowed in owned rows', [
        ...path,
        '#ref'
      ])
    }
    const id = isPlainObject(value) ? value[key.name] : undefined
    const idPath = [...path, key.name]
    // A pivot row is keyed by a relation to a stored row, which it requires.
    // Only matching tells whether the row is new.
    const isPivot = isOwningToOne(key)
    const message = isPivot
      ? isPlainObject(id) && '#ref' in id
        ? 'is not allowed to reference a new row'
        : undefined
      : isParentNew && id != null
        ? 'is not allowed in a new row'
        : undefined
    if (message) this.invalidValue(message, idPath)
    const isNew = isParentNew || (id == null && !isPivot)
    const row = this.cleanRow(target, value, path, isNew, prop.mappedBy)
    if (isPivot) {
      if (row && !isNew && id === undefined) this.invalidType('id', id, idPath)
    } else if (row && !isNew) {
      row[key.name] = toPrimaryKey(key, id)
      if (row[key.name] === undefined) this.invalidType('id', id, idPath)
    }
    const newRow = row && this.newRows.get(row)
    if (newRow) newRow.place = place
    return row
  }

  // An id of the target, `{ [key]: id }`, or `{ '#ref': key }` for a new row
  // of the body, which stays out of the data.
  cleanId(row: Row, prop: EntityProperty, value: unknown, path: Path) {
    const isObject = isPlainObject(value)
    if (isObject && '#ref' in value) {
      const key = value['#ref']
      if (isString(key)) this.refs.push({ key, row, prop, path })
      else this.invalidType('string', key, [...path, '#ref'])
      return undefined
    }
    const key = getPrimaryKey(prop.targetMeta!)
    const sent = isObject ? value[key.name] : value
    const id = toPrimaryKey(key, sent)
    if (id === undefined) {
      this.invalidType('id', sent, isObject ? [...path, key.name] : path)
    } else {
      this.ids.push({ row, prop, id, path })
    }
    return id
  }

  // Checks the type of a scalar, the items of an enum, and the bounds that the
  // column declares, which Postgres would refuse without a field. Postgres
  // checks the ranges of numbers.
  cleanScalar(prop: EntityProperty, value: unknown, path: Path) {
    if (prop.customType instanceof ArrayType) {
      return this.cleanArray(prop, value, path)
    }
    const type = getType(prop)
    const { items, length, precision, scale = 0 } = prop
    if (scalarChecks[type]?.(value) === false) {
      return this.invalidType(type, value, path)
    }
    if (prop.enum && items && !items.includes(value as never)) {
      return this.invalidOption(items, path)
    }
    if (prop.customType instanceof DecimalType && precision) {
      // Postgres rounds the fraction to the scale, but refuses more integer
      // digits than the precision leaves:
      const limit = 10 ** (precision - scale)
      const number = Number(value)
      if (number >= limit) return this.tooBig(`number to be <${limit}`, path)
      if (number <= -limit) {
        return this.tooSmall(`number to be >${-limit}`, path)
      }
    } else if (type === 'string' && isString(value)) {
      // Postgres counts the characters of a string, not its UTF-16 units.
      if (length && [...value].length > length) {
        return this.tooBig(`string to have <=${length} characters`, path)
      }
      // As the `required` of Dito.js 6, a required string can't be empty.
      if (value === '' && isRequired(prop)) {
        return this.tooSmall('string to have >=1 characters', path)
      }
    }
    const { schema } = (prop.customType ?? {}) as { schema?: z.ZodType }
    if (schema) {
      this.pending.push(this.checkSchema(schema, value, path))
    }
    // A plain date, such as `2026-05-14`, is local midnight, which
    // `new Date()` would read as UTC midnight.
    return (type === 'date' && parsePlainDate(value as string)) || value
  }

  // Checks the items of an array column by the type of its column, such as
  // `int[]`, and the items of an enum array.
  cleanArray(prop: EntityProperty, value: unknown, path: Path) {
    if (!isArray(value)) return this.invalidType('array', value, path)
    const type = getItemType(prop)
    const { items } = prop
    value.forEach((item, index) => {
      const itemPath = [...path, index]
      if (!scalarChecks[type]!(item)) {
        this.invalidType(type, item, itemPath)
      } else if (
        prop.customType instanceof EnumArrayType &&
        items &&
        !items.includes(item as never)
      ) {
        this.invalidOption(items, itemPath)
      }
    })
    return value
  }

  // Runs the schema of a custom type, such as that of `defineJsonType()`, on
  // the value as sent. Its output isn't written.
  async checkSchema(schema: z.ZodType, value: unknown, path: Path) {
    const { issues = [] } = await runSchema(schema, value)
    for (const issue of issues) {
      this.issues.push({
        path: [...path, ...(issue.path ?? [])],
        message: issue.message,
        code: isString(issue.code) ? issue.code : 'custom'
      })
    }
  }
}

// The checks of scalars by type. MikroORM converts some values silently, such
// as any string to `true` for a boolean.
const scalarChecks: Record<string, (value: unknown) => boolean> = {
  string: isString,
  number: Number.isFinite,
  int: Number.isInteger,
  boolean: isBoolean,
  date: value => isString(value) && !isNaN(Date.parse(value)),
  // Decimals in string mode take numbers too.
  decimal: value => (
    Number.isFinite(value) ||
    (isString(value) && value.trim() !== '' && Number.isFinite(Number(value)))
  )
}

// The type of a property, as `scalarChecks` and messages name it.
const getType = (prop: EntityProperty) =>
  isOwningToOne(prop)
    ? 'id'
    : isOwned(prop)
      ? 'object'
      : prop.runtimeType === 'Date'
        ? 'date'
        : (
              prop.customType instanceof DecimalType &&
              prop.runtimeType === 'string'
            )
          ? 'decimal'
          : (
                prop.runtimeType === 'number' &&
                (prop.columnTypes?.[0] ?? '') in integerBits
              )
            ? 'int'
            : prop.runtimeType

// The type of the items of an array column, by the type of its column.
// MikroORM gives all array columns the type `string[]`.
const getItemType = (prop: EntityProperty) => {
  const column = (prop.columnTypes?.[0] ?? '').replace(/(\(.*\))?\[\]$/, '')
  return column in integerBits
    ? 'int'
    : /^(numeric|decimal|real|double|float)/.test(column)
      ? 'number'
      : /^bool/.test(column)
        ? 'boolean'
        : 'string'
}

// Whether a client may write the property. Of the primary keys, only the
// relations of composite keys are written, as in pivot rows. `onCreate` fills
// scalars and relations that clients can't set, such as `createdAt`, and gives
// JSON and array columns their defaults, which clients can set. JSON can't
// hold the bytes of a blob.
const isWritable = (prop: EntityProperty, meta: EntityMetadata) => (
  (!prop.primary || (meta.compositePK && isOwningToOne(prop))) &&
  prop.runtimeType !== 'Buffer' &&
  prop.persist !== false &&
  !prop.hidden &&
  !prop.formula &&
  !prop.version &&
  !prop.generated &&
  !prop.onUpdate &&
  (!prop.onCreate || /^jsonb?$|\[\]$/.test(prop.columnTypes?.[0] ?? '')) && (
    prop.kind === ReferenceKind.SCALAR ||
    prop.kind === ReferenceKind.MANY_TO_MANY ||
    isOwningToOne(prop) ||
    isOwned(prop)
  )
)

// The writable properties of an entity, once per entity.
const writableProps = new WeakMap<EntityMetadata, EntityProperty[]>()

function getWritableProps(meta: EntityMetadata) {
  let props = writableProps.get(meta)
  if (!props) {
    props = meta.props.filter(prop => isWritable(prop, meta))
    writableProps.set(meta, props)
  }
  return props
}

const isRequired = (prop: EntityProperty) => (
  !prop.nullable &&
  prop.default === undefined &&
  prop.defaultRaw === undefined &&
  !prop.onCreate &&
  (prop.kind === ReferenceKind.SCALAR || isOwningToOne(prop))
)

// The paths of the owned and many-to-many relations that `row` sets, at any
// depth, such as `chapters.sections`.
function getPopulatePaths(
  meta: EntityMetadata,
  row: Row,
  prefix = '',
  paths = new Set<string>()
) {
  for (const prop of meta.props) {
    const value = row[prop.name]
    if (value == null) continue
    const path = `${prefix}${prop.name}`
    if (prop.kind === ReferenceKind.MANY_TO_MANY || isOwned(prop)) {
      paths.add(path)
    }
    for (const child of getOwnedRows(prop, value)) {
      getPopulatePaths(prop.targetMeta!, child, `${path}.`, paths)
    }
  }
  return paths
}

// Matches the owned rows of `row` that have ids to the loaded rows of
// `record`, at any depth, and returns the records by row. `em.assign()`
// matches them by id too, and would move a row of another record into this
// one. Pivot rows that match no loaded row are new.
function matchOwnedRows(meta: EntityMetadata, run: Run, record: object) {
  const records = new Map<Row, Row>()
  const match = (meta: EntityMetadata, row: Row, record: Row, path: Path) => {
    records.set(row, record)
    for (const prop of meta.props) {
      if (!isOwned(prop) || row[prop.name] == null) continue
      const target = prop.targetMeta!
      const key = getRowKey(prop)
      const isPivot = isOwningToOne(key)
      const getKey = (item: Row) =>
        isPivot ? wrap(item[key.name], true).getPrimaryKey() : item[key.name]
      const existing = new Map(
        getLoaded(record, prop).map(item => [getKey(item), item])
      )
      const isMany = prop.kind === ReferenceKind.ONE_TO_MANY
      getOwnedRows(prop, row[prop.name]).forEach((child, index) => {
        if (child[key.name] == null) return
        const childPath = [...path, prop.name, ...(isMany ? [index] : [])]
        const found = existing.get(child[key.name])
        // MikroORM finds a pivot row by both of its keys.
        if (isPivot) child[prop.mappedBy] = wrap(record, true).getPrimaryKey()
        if (found) {
          match(target, child, found, childPath)
        } else if (isPivot) {
          // A new pair, whose required columns `cleanRow()` didn't check.
          for (const required of getWritableProps(target).filter(isRequired)) {
            if (child[required.name] === undefined) {
              const type = getType(required)
              run.invalidType(type, undefined, [...childPath, required.name])
            }
          }
          // `em.assign()` creates the pair, which `setRefs()` can't reach.
          for (const ref of run.refs) {
            if (ref.row === child) {
              run.invalidValue(
                'is not allowed to reference a new row',
                ref.path
              )
            }
          }
        } else {
          run.invalidValue(`is not a row of this ${meta.className}`, [
            ...childPath,
            key.name
          ])
        }
      })
    }
  }
  match(meta, run.row, record as Row, [])
  if (run.issues.length) throw createValidationError(run.issues)
  return records
}

// The key of an owned row within its parent: its primary key, or for a pivot
// entity with two keys, the relation that isn't the one back to the parent.
function getRowKey(prop: EntityProperty) {
  const target = prop.targetMeta!
  const keys = target.primaryKeys.filter(name => name !== prop.mappedBy)
  const key = keys.length === 1 && target.properties[keys[0]!]
  return target.primaryKeys.length === 2 && key && isOwningToOne(key)
    ? key
    : getPrimaryKey(target)
}

// A function that tells whether the record of a row links an id. It keeps the
// linked ids of each relation, by the relation's value.
function getLinkCheck(records: Map<Row, Row>) {
  const linked = new Map<unknown, Set<string>>()
  return ({ row, prop, id }: RelationId) => {
    const record = records.get(row) ?? {}
    const value = record[prop.name]
    let ids = linked.get(value)
    if (!ids) {
      ids = new Set(
        getLoaded(record, prop).map(item =>
          String(wrap(item, true).getPrimaryKey())
        )
      )
      linked.set(value, ids)
    }
    return ids.has(String(id))
  }
}

// A relation set by id would link any row with that id. Checks that each id
// names a row of its target that MikroORM's default filters let through,
// such as one that isn't soft deleted, with one query per target entity.
async function checkIds(em: EntityManager, ids: RelationId[]) {
  const byTarget = Map.groupBy(ids, ({ prop }) => prop.targetMeta!)
  const issues: ValidationIssue[] = []
  await mapConcurrently([...byTarget], async ([target, items]) => {
    const key = getPrimaryKey(target).name
    // Skips the identity map, since rows loaded with their ids only would go
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

// Checks that each ref names a new row of the relation's target.
function checkRefs(run: Run) {
  for (const { key, prop, path } of run.refs) {
    const source = run.sources.get(key)
    const target = prop.targetMeta!
    const message = !source
      ? `references the unknown new row '${key}'`
      : !isA(source.meta, target)
        ? `references a new row that is no ${target.className}`
        : undefined
    if (message) run.invalidValue(message, path)
  }
}

const isA = (meta: EntityMetadata, target: EntityMetadata) => (
  meta.class === target.class || meta.class.prototype instanceof target.class
)

// Creates the new nested rows that carry `#id` or hold refs, and puts each one
// in its place in the data.
function createNewRows(em: EntityManager, run: Run) {
  for (const newRow of run.newRows.values()) {
    const entity = em.create(newRow.meta.class, newRow.row as never)
    newRow.entity = entity
    newRow.place!(entity)
  }
}

// Sets the relations of the refs, on the new nested rows and on the entities
// that `getEntity` returns for other rows.
function setRefs(run: Run, getEntity: (row: Row) => object | undefined) {
  for (const { key, row, prop } of run.refs) {
    const entity = run.sources.get(key)!.entity
    const holder = (run.newRows.get(row)?.entity ?? getEntity(row)) as Row
    if (isToMany(prop)) holder[prop.name].add(entity)
    else holder[prop.name] = entity
  }
}
