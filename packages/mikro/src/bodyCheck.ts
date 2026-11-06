import type { z } from 'zod'
import { createValidationError, type ValidationIssue } from '@ditojs/server'
import { isArray, isPlainObject, isString, parsePlainDate } from '@ditojs/utils'
import {
  ReferenceKind,
  type EntityMetadata,
  type EntityProperty
} from '@mikro-orm/core'
import {
  getPrimaryKey,
  isOwned,
  isOwningToOne,
  isToMany,
  toPrimaryKey,
  type Row
} from './metadata.ts'
import { getColumnSchema, getType } from './columnSchema.ts'
import { runSchema } from './validation.ts'

// The first pass of a write: reads a body with the entity's metadata, without
// the database. See `records.ts` for what follows.

type StandardIssue = Pick<ValidationIssue, 'message'> & {
  path?: readonly any[]
  code?: unknown
}

export type Path = (string | number)[]

export interface RelationId {
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

// A new nested row that carries `#id`.
interface NewRow {
  meta: EntityMetadata
  row: Row
}

const writableProps = new WeakMap<EntityMetadata, EntityProperty[]>()

// One pass through a body, which keeps the checked values and collects the
// issues at their paths, and the ids, refs and new rows for the later steps.
export class BodyCheck {
  row!: Row
  issues: ValidationIssue[] = []
  // The schemas run together, after the pass.
  schemaChecks: Promise<void>[] = []
  ids: RelationId[] = []
  refs: Ref[] = []
  newRowsByKey = new Map<string, NewRow>()
  // The paths of the `#id` keys, by their rows, for `matchRows()`.
  keyPaths = new Map<Row, Path>()
  // The owned and many-to-many relations that the body sets, at any depth, as
  // dotted paths such as `chapters.sections`.
  populate = new Set<string>()

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

  addIssues(issues: readonly StandardIssue[], path: Path) {
    for (const issue of issues) {
      this.issues.push({
        path: [...path, ...(issue.path ?? [])],
        message: issue.message,
        code: isString(issue.code) ? issue.code : 'custom'
      })
    }
  }

  cleanRow(meta: EntityMetadata, data: unknown, path: Path, parent?: string) {
    if (!isPlainObject(data)) return this.addTypeIssue('object', data, path)
    const row: Row = {}
    // The nesting sets the relation back to the parent row:
    const props = getWritableProps(meta).filter(prop => prop.name !== parent)
    for (const prop of props) {
      const value = data[prop.name]
      if (value !== undefined) {
        const cleaned = this.cleanValue(row, prop, value, [...path, prop.name])
        if (cleaned !== undefined) row[prop.name] = cleaned
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
    if ('#id' in data) this.addRowKey(meta, row, data['#id'], path)
    return row
  }

  addRowKey(meta: EntityMetadata, row: Row, key: unknown, path: Path) {
    const keyPath = [...path, '#id']
    if (!isString(key)) return this.addTypeIssue('string', key, keyPath)
    if (this.newRowsByKey.has(key)) {
      return this.addIssue(`is the key of another new row '${key}'`, keyPath)
    }
    this.newRowsByKey.set(key, { meta, row })
    this.keyPaths.set(row, keyPath)
  }

  // Return undefined for values that stay out of the data.
  cleanValue(
    row: Row,
    prop: EntityProperty,
    value: unknown,
    path: Path
  ): unknown {
    const isManyToMany = prop.kind === ReferenceKind.MANY_TO_MANY
    if (value !== null && (isOwned(prop) || isManyToMany)) {
      this.populate.add(path.filter(isString).join('.'))
    }
    if (isToMany(prop)) {
      if (!isArray(value)) return this.addTypeIssue('array', value, path)
      const items: unknown[] = value.map((item, index) =>
        isOwned(prop)
          ? this.cleanOwnedRow(prop, item, [...path, index])
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
    if (isOwned(prop)) return this.cleanOwnedRow(prop, value, path)
    return isOwningToOne(prop)
      ? this.cleanId(row, prop, value, path)
      : this.cleanScalar(prop, value, path)
  }

  // An owned row carries its key, which `matchRows()` matches to a row of the
  // record. The key of a pivot row is a writable relation, which `cleanRow()`
  // reads. The id of other rows isn't writable, so read it here.
  cleanOwnedRow(prop: EntityProperty, value: unknown, path: Path) {
    if (isPlainObject(value) && '#ref' in value) {
      return this.addIssue('is not allowed in owned rows', [...path, '#ref'])
    }
    const row = this.cleanRow(prop.targetMeta!, value, path, prop.mappedBy)
    const key = getRowKey(prop)
    const id = (value as Row | undefined)?.[key.name]
    if (row && !isOwningToOne(key) && id != null) {
      row[key.name] = toPrimaryKey(key, id)
      if (row[key.name] === undefined) {
        this.addTypeIssue('id', id, [...path, key.name])
      }
    }
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

  // The schema of the column only validates. The value is written as sent.
  cleanScalar(prop: EntityProperty, value: unknown, path: Path) {
    const schema = getColumnSchema(prop)
    this.schemaChecks.push(this.checkSchema(schema, value, path))
    // A plain date, such as `2026-05-14`, is local midnight, which
    // `new Date()` would read as UTC midnight.
    return (
      (getType(prop) === 'date' && parsePlainDate(value as string)) ||
      value
    )
  }

  async checkSchema(schema: z.ZodType, value: unknown, path: Path) {
    const { issues = [] } = await runSchema(schema, value)
    this.addIssues(issues as StandardIssue[], path)
  }
}

// Keep the properties that a client may write, and check the values that
// Postgres can't check well:
export async function clean(meta: EntityMetadata, data: unknown) {
  const check = new BodyCheck()
  check.row = check.cleanRow(meta, data, [])!
  await Promise.all(check.schemaChecks)
  // Without a row, there is nothing to match.
  if (!check.row) throw createValidationError(check.issues)
  return check
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

export function getWritableProps(meta: EntityMetadata) {
  let props = writableProps.get(meta)
  if (!props) {
    props = meta.props.filter(prop => isWritable(prop, meta))
    writableProps.set(meta, props)
  }
  return props
}

// The key of an owned row within its parent: its primary key, or for a pivot
// entity with two keys, the relation that isn't the one back to the parent.
export function getRowKey(prop: EntityProperty) {
  const target = prop.targetMeta!
  const keys = target.primaryKeys.filter(name => name !== prop.mappedBy)
  const key = keys.length === 1 && target.properties[keys[0]!]
  return target.primaryKeys.length === 2 && key && isOwningToOne(key)
    ? key
    : getPrimaryKey(target)
}

export function checkRefs(check: BodyCheck) {
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
