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
  getLoadedRows,
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

// The writes of the default `post` and `patch :id`, also for custom handlers.

type Path = (string | number)[]

interface RelationId {
  row: Row
  prop: EntityProperty
  id: unknown
  path: Path
}

// A new nested row has no id yet, so a body marks it with `#id`, and a relation
// to it is `{ '#ref': <the same key> }`.
interface Ref {
  key: string
  row: Row
  prop: EntityProperty
  path: Path
}

// A new nested row that carries `#id` or holds refs, created on its own before
// the record. `place` puts its entity where the row is in the data.
interface NewRow {
  meta: EntityMetadata
  row: Row
  place?: (entity: object) => void
  entity?: object
}

// MikroORM converts some values silently, such as any string to `true` for a
// boolean:
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

const writableProps = new WeakMap<EntityMetadata, EntityProperty[]>()

// Neither write flushes, so handlers can work on the entities first.
export async function createRecord<T extends object>(
  em: EntityManager,
  entity: EntityName<T>,
  data: unknown
): Promise<T> {
  const meta = em.getMetadata().get(entity)
  const check = await clean(meta, data, true)
  await checkIds(em, check.ids)
  createNewRows(em, check)
  const record = em.create(entity, check.row as never)
  setRefs(check, row => (row === check.row ? record : undefined))
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
  const check = await clean(meta, data, false)
  const { row } = check
  // Load the owned rows to match them by id, and the many-to-many collections,
  // which MikroORM else writes as new pivot rows, losing their other columns:
  const paths = [...getPopulatePaths(meta, row)]
  if (paths.length) await em.populate(record, paths as never)
  const records = matchOwnedRows(meta, check, record)
  // Ids that the record already links need no check.
  const isLinked = createIsLinked(records)
  await checkIds(
    em,
    check.ids.filter(id => !isLinked(id))
  )
  createNewRows(em, check)
  em.assign(record, row as never, { onlyProperties: true })
  setRefs(check, row => records.get(row))
  return record
}

// One pass through a body, which keeps the checked values and collects the
// issues at their paths, and the ids, refs and new rows for the later steps.
class BodyCheck {
  row!: Row
  issues: ValidationIssue[] = []
  // The schemas run together, after the pass.
  schemaChecks: Promise<void>[] = []
  ids: RelationId[] = []
  refs: Ref[] = []
  newRowsByKey = new Map<string, NewRow>()
  // In the order of their creation: nested rows before their parents.
  newRows = new Map<Row, NewRow>()

  addIssue(message: string, path: Path, code = 'invalid_value') {
    this.issues.push({ path, code, message })
  }

  addTypeIssue(expected: string, value: unknown, path: Path) {
    const received =
      value === null ? 'null' : isArray(value) ? 'array' : typeof value
    this.addIssue(
      `Invalid input: expected ${expected}, received ${received}`,
      path,
      'invalid_type'
    )
  }

  addOptionIssue(items: unknown[], path: Path) {
    const options = items.map(item => JSON.stringify(item)).join('|')
    this.addIssue(`Invalid option: expected one of ${options}`, path)
  }

  addSizeIssue(code: 'too_big' | 'too_small', expected: string, path: Path) {
    const size = code === 'too_big' ? 'Too big' : 'Too small'
    this.addIssue(`${size}: expected ${expected}`, path, code)
  }

  cleanRow(
    meta: EntityMetadata,
    data: unknown,
    path: Path,
    isNew: boolean,
    parent?: string
  ) {
    if (!isPlainObject(data)) return this.addTypeIssue('object', data, path)
    const row: Row = {}
    // The nesting sets the relation back to the parent row:
    const props = getWritableProps(meta).filter(prop => prop.name !== parent)
    for (const prop of props) {
      const value = data[prop.name]
      if (value !== undefined) {
        const valuePath = [...path, prop.name]
        const cleaned = this.cleanValue(row, prop, value, valuePath, isNew)
        if (cleaned !== undefined) row[prop.name] = cleaned
      } else if (isNew && isRequired(prop)) {
        this.addTypeIssue(getType(prop), value, [...path, prop.name])
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
        this.addIssue(message, [...path, prop.name])
      }
    }
    const keyedRow =
      '#id' in data
        ? this.addRowKey(meta, row, data['#id'], path, isNew)
        : undefined
    const hasRefs = this.refs.some(ref => ref.row === row)
    if (keyedRow || (path.length && isNew && hasRefs)) {
      this.newRows.set(row, keyedRow ?? { meta, row })
    }
    return row
  }

  // Only new nested rows can carry `#id`.
  addRowKey(
    meta: EntityMetadata,
    row: Row,
    key: unknown,
    path: Path,
    isNew: boolean
  ) {
    const keyPath = [...path, '#id']
    if (!isString(key)) return this.addTypeIssue('string', key, keyPath)
    const message = !isNew
      ? 'is not allowed in a row with an id'
      : !path.length
        ? 'is only allowed in nested rows'
        : this.newRowsByKey.has(key)
          ? `is the key of another new row '${key}'`
          : undefined
    if (message) return this.addIssue(message, keyPath)
    const keyedRow = { meta, row }
    this.newRowsByKey.set(key, keyedRow)
    return keyedRow
  }

  // Return undefined for values that stay out of the data.
  cleanValue(
    row: Row,
    prop: EntityProperty,
    value: unknown,
    path: Path,
    isNew: boolean
  ): unknown {
    if (isToMany(prop)) {
      if (!isArray(value)) return this.addTypeIssue('array', value, path)
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
        for (const [index, id] of ids.entries()) {
          if (id != null && ids.indexOf(id) < index) {
            this.addIssue('is the key of another row', [...path, index, key])
          }
        }
      }
      return isOwned(prop) ? items : items.filter(item => item !== undefined)
    }
    if (value === null) {
      // Null removes an owned row.
      return prop.nullable ? null : this.addTypeIssue(getType(prop), null, path)
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

  // In owned relations, a row with an id updates that row of the record, and a
  // row without one is new.
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
      return this.addIssue('is not allowed in owned rows', [...path, '#ref'])
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
    if (message) this.addIssue(message, idPath)
    const isNew = isParentNew || (id == null && !isPivot)
    const row = this.cleanRow(target, value, path, isNew, prop.mappedBy)
    if (isPivot) {
      if (row && !isNew && id === undefined) this.addTypeIssue('id', id, idPath)
    } else if (row && !isNew) {
      row[key.name] = toPrimaryKey(key, id)
      if (row[key.name] === undefined) this.addTypeIssue('id', id, idPath)
    }
    const newRow = row && this.newRows.get(row)
    if (newRow) newRow.place = place
    return row
  }

  // An id is sent plain or as `{ [key]: id }`. A `{ '#ref': key }` stays out of
  // the data until `setRefs()`.
  cleanId(row: Row, prop: EntityProperty, value: unknown, path: Path) {
    const isObject = isPlainObject(value)
    if (isObject && '#ref' in value) {
      const key = value['#ref']
      if (isString(key)) this.refs.push({ key, row, prop, path })
      else this.addTypeIssue('string', key, [...path, '#ref'])
      return undefined
    }
    const key = getPrimaryKey(prop.targetMeta!)
    const sent = isObject ? value[key.name] : value
    const id = toPrimaryKey(key, sent)
    if (id === undefined) {
      this.addTypeIssue('id', sent, isObject ? [...path, key.name] : path)
    } else {
      this.ids.push({ row, prop, id, path })
    }
    return id
  }

  // Check the bounds that the column declares, which Postgres would refuse
  // without naming a field. Postgres checks the ranges of numbers itself.
  cleanScalar(prop: EntityProperty, value: unknown, path: Path) {
    if (prop.customType instanceof ArrayType) {
      return this.cleanArray(prop, value, path)
    }
    const type = getType(prop)
    const { items, length, precision, scale = 0 } = prop
    if (scalarChecks[type]?.(value) === false) {
      return this.addTypeIssue(type, value, path)
    }
    if (prop.enum && items && !items.includes(value as never)) {
      return this.addOptionIssue(items, path)
    }
    if (prop.customType instanceof DecimalType && precision) {
      // Postgres rounds the fraction to the scale, but refuses more integer
      // digits than the precision leaves:
      const limit = 10 ** (precision - scale)
      const number = Number(value)
      if (number >= limit) {
        return this.addSizeIssue('too_big', `number to be <${limit}`, path)
      }
      if (number <= -limit) {
        return this.addSizeIssue('too_small', `number to be >${-limit}`, path)
      }
    } else if (type === 'string' && isString(value)) {
      // Postgres counts the characters of a string, not its UTF-16 units.
      if (length && [...value].length > length) {
        const expected = `string to have <=${length} characters`
        return this.addSizeIssue('too_big', expected, path)
      }
      // As the `required` of Dito.js 6, a required string can't be empty.
      if (value === '' && isRequired(prop)) {
        const expected = 'string to have >=1 characters'
        return this.addSizeIssue('too_small', expected, path)
      }
    }
    this.checkCustomSchema(prop, value, path)
    // A plain date, such as `2026-05-14`, is local midnight, which
    // `new Date()` would read as UTC midnight.
    return (type === 'date' && parsePlainDate(value as string)) || value
  }

  cleanArray(prop: EntityProperty, value: unknown, path: Path) {
    if (!isArray(value)) return this.addTypeIssue('array', value, path)
    const type = getItemType(prop)
    const { items } = prop
    const { length } = this.issues
    for (const [index, item] of value.entries()) {
      const itemPath = [...path, index]
      if (!scalarChecks[type]!(item)) {
        this.addTypeIssue(type, item, itemPath)
      } else if (
        prop.customType instanceof EnumArrayType &&
        items &&
        !items.includes(item as never)
      ) {
        this.addOptionIssue(items, itemPath)
      }
    }
    // As for scalars, only valid values go through the custom type's schema.
    if (this.issues.length === length) {
      this.checkCustomSchema(prop, value, path)
    }
    return value
  }

  checkCustomSchema(prop: EntityProperty, value: unknown, path: Path) {
    const { schema } = (prop.customType ?? {}) as { schema?: z.ZodType }
    if (schema) this.schemaChecks.push(this.checkSchema(schema, value, path))
  }

  // The schema only validates the value as sent. Its output isn't written.
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

// Keep the properties that a client may write, and check the values that
// Postgres can't check well:
async function clean(meta: EntityMetadata, data: unknown, isNew: boolean) {
  const check = new BodyCheck()
  check.row = check.cleanRow(meta, data, [], isNew)!
  await Promise.all(check.schemaChecks)
  checkRefs(check)
  if (check.issues.length) throw createValidationError(check.issues)
  return check
}

// The type of a property, as `scalarChecks` and messages name it.
function getType(prop: EntityProperty) {
  const { runtimeType } = prop
  const isDecimalString = (
    prop.customType instanceof DecimalType &&
    runtimeType === 'string'
  )
  const isInteger = (
    runtimeType === 'number' &&
    (prop.columnTypes?.[0] ?? '') in integerBits
  )
  return isOwningToOne(prop)
    ? 'id'
    : isOwned(prop)
      ? 'object'
      : runtimeType === 'Date'
        ? 'date'
        : isDecimalString
          ? 'decimal'
          : isInteger
            ? 'int'
            : runtimeType
}

// MikroORM gives all array columns the type `string[]`, so read the type of the
// column, such as `int[]`:
function getItemType(prop: EntityProperty) {
  const column = (prop.columnTypes?.[0] ?? '').replace(/(\(.*\))?\[\]$/, '')
  return column in integerBits
    ? 'int'
    : /^(numeric|decimal|real|double|float)/.test(column)
      ? 'number'
      : /^bool/.test(column)
        ? 'boolean'
        : 'string'
}

function isWritable(prop: EntityProperty, meta: EntityMetadata) {
  return (
    // Of the primary keys, only the relations of composite keys are written,
    // as in pivot rows:
    (!prop.primary || (meta.compositePK && isOwningToOne(prop))) &&
    // JSON can't hold the bytes of a blob:
    prop.runtimeType !== 'Buffer' &&
    prop.persist !== false &&
    !prop.hidden &&
    !prop.formula &&
    !prop.version &&
    !prop.generated &&
    !prop.onUpdate &&
    // `onCreate` fills values that clients can't set, such as `createdAt`,
    // except on JSON and array columns, whose defaults clients can override:
    (!prop.onCreate || /^jsonb?$|\[\]$/.test(prop.columnTypes?.[0] ?? '')) && (
      prop.kind === ReferenceKind.SCALAR ||
      prop.kind === ReferenceKind.MANY_TO_MANY ||
      isOwningToOne(prop) ||
      isOwned(prop)
    )
  )
}

function getWritableProps(meta: EntityMetadata) {
  let props = writableProps.get(meta)
  if (!props) {
    props = meta.props.filter(prop => isWritable(prop, meta))
    writableProps.set(meta, props)
  }
  return props
}

function isRequired(prop: EntityProperty) {
  return (
    !prop.nullable &&
    prop.default === undefined &&
    prop.defaultRaw === undefined &&
    !prop.onCreate &&
    (prop.kind === ReferenceKind.SCALAR || isOwningToOne(prop))
  )
}

// Collect the owned and many-to-many relations that `row` sets, at any depth,
// such as `chapters.sections`:
function getPopulatePaths(
  meta: EntityMetadata,
  row: Row,
  prefix = '',
  paths = new Set<string>()
) {
  for (const prop of meta.props) {
    const value = row[prop.name]
    if (value != null) {
      const path = `${prefix}${prop.name}`
      if (prop.kind === ReferenceKind.MANY_TO_MANY || isOwned(prop)) {
        paths.add(path)
      }
      for (const child of getOwnedRows(prop, value)) {
        getPopulatePaths(prop.targetMeta!, child, `${path}.`, paths)
      }
    }
  }
  return paths
}

// Match the owned rows with ids to the loaded rows of `record`, at any depth:
// `em.assign()` matches by id alone, and would move a row of another record
// into this one. Pivot rows that match no loaded row are new.
function matchOwnedRows(
  meta: EntityMetadata,
  check: BodyCheck,
  record: object
) {
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
        getLoadedRows(record, prop).map(item => [getKey(item), item])
      )
      const isMany = prop.kind === ReferenceKind.ONE_TO_MANY
      const children = getOwnedRows(prop, row[prop.name])
      for (const [index, child] of children.entries()) {
        if (child[key.name] == null) continue
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
              check.addTypeIssue(type, undefined, [...childPath, required.name])
            }
          }
          // `em.assign()` creates the pair, which `setRefs()` can't reach.
          for (const ref of check.refs) {
            if (ref.row === child) {
              check.addIssue('is not allowed to reference a new row', ref.path)
            }
          }
        } else {
          check.addIssue(`is not a row of this ${meta.className}`, [
            ...childPath,
            key.name
          ])
        }
      }
    }
  }
  match(meta, check.row, record as Row, [])
  if (check.issues.length) throw createValidationError(check.issues)
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

function checkRefs(check: BodyCheck) {
  for (const { key, prop, path } of check.refs) {
    const keyedRow = check.newRowsByKey.get(key)
    const target = prop.targetMeta!
    const message = !keyedRow
      ? `references the unknown new row '${key}'`
      : !isSameOrSubclass(keyedRow.meta, target)
        ? `references a new row that is no ${target.className}`
        : undefined
    if (message) check.addIssue(message, path)
  }
}

function isSameOrSubclass(meta: EntityMetadata, target: EntityMetadata) {
  return (
    meta.class === target.class ||
    meta.class.prototype instanceof target.class
  )
}

// Create the new nested rows deepest first, before the record:
function createNewRows(em: EntityManager, check: BodyCheck) {
  for (const newRow of check.newRows.values()) {
    const entity = em.create(newRow.meta.class, newRow.row as never)
    newRow.entity = entity
    newRow.place!(entity)
  }
}

// Set the refs once the record is created or assigned, on the new nested rows
// and on the entities that `getEntity` returns for other rows:
function setRefs(
  check: BodyCheck,
  getEntity: (row: Row) => object | undefined
) {
  for (const { key, row, prop } of check.refs) {
    const entity = check.newRowsByKey.get(key)!.entity
    const holder = (check.newRows.get(row)?.entity ?? getEntity(row)) as Row
    if (isToMany(prop)) holder[prop.name].add(entity)
    else holder[prop.name] = entity
  }
}
