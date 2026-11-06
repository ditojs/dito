import { HttpError, createValidationError } from '@ditojs/server'
import {
  ConstraintViolationException,
  DriverException,
  NotFoundError,
  OptimisticLockError,
  type EntityMetadata,
  type EntityProperty
} from '@mikro-orm/core'
import { isOwned } from './metadata.ts'

// Postgres checks the types, ranges and lengths of the values that a write
// sends, beyond what `write.ts` checks.

const invalidMessage = 'The data is not valid for the database.'
const conflictMessage = 'The data conflicts with rows in the database.'

export function toHttpError(
  error: unknown,
  meta?: EntityMetadata,
  method?: string
) {
  if (error instanceof NotFoundError) {
    return new HttpError(404, { cause: error })
  }
  if (error instanceof OptimisticLockError) {
    return new HttpError(409, {
      message: 'A more recent version exists in the database.',
      cause: error
    })
  }
  // Leave errors that aren't MikroORM's to the server:
  if (!(error instanceof DriverException)) return undefined
  const {
    table,
    column,
    constraint,
    detail = ''
  } = error as DriverException & {
    table?: string
    column?: string
    constraint?: string
    detail?: string
  }
  // Errors on the table of the request's entity point at the property, such as
  // `name`. Errors on other tables, or on a table that owned rows share, can't
  // tell the rows apart:
  const isRootTable = !!meta && table === meta.tableName
  const root =
    isRootTable && !ownsTable(meta!, meta!.tableName) ? meta : undefined
  const createError = (
    status: 400 | 409,
    columns: (string | undefined)[] = [],
    issue?: { message: string; code: string }
  ) => {
    const props = root && issue ? getProperties(root, columns) : []
    const issues = props.map(prop => ({ path: [prop.name], ...issue! }))
    const message = status === 400 ? invalidMessage : conflictMessage
    return issues.length
      ? createValidationError(issues, { message, status, cause: error })
      : new HttpError(status, { message, cause: error })
  }
  const code = error.sqlState ?? error.code
  switch (code) {
    case '23502':
      return createError(400, [column], {
        message: 'is required',
        code: 'invalid_type'
      })
    case '23505':
      return createError(409, getKeyColumns(detail), {
        message: 'already exists',
        code: 'not_unique'
      })
    case '23503':
      // Postgres names the referencing table, even when a delete fails
      // because other rows still reference the deleted one. A write can
      // delete rows too, such as the owned rows that it leaves out.
      return (
        method === 'DELETE' ||
        detail.includes('is still referenced') ||
        (meta && !isRootTable)
      )
        ? createError(409)
        : createError(400, getKeyColumns(detail), {
            message: 'references a missing row',
            code: 'invalid_value'
          })
    case '23514': {
      const prefix = `${table}_`
      return createError(
        400,
        constraint?.startsWith(prefix) && constraint.endsWith('_check')
          ? [constraint.slice(prefix.length, -'_check'.length)]
          : [],
        { message: 'fails a check', code: 'invalid_value' }
      )
    }
  }
  // Postgres' data exceptions, such as a value too long or out of range.
  if (code?.startsWith('22')) return createError(400)
  if (error instanceof ConstraintViolationException) return createError(409)
  // Other database errors are internal:
  return new HttpError(500, { cause: error })
}

// Look for owned relations that hold rows of `table`, at any depth:
function ownsTable(
  meta: EntityMetadata,
  table: string,
  seen = new Set<EntityMetadata>([meta])
): boolean {
  return meta.props.some(prop => {
    const target = prop.targetMeta
    if (!isOwned(prop) || !target) return false
    if (target.tableName === table) return true
    if (seen.has(target)) return false
    seen.add(target)
    return ownsTable(target, table, seen)
  })
}

// Read the columns of a detail such as `Key (a, "b")=(1, 2) …`:
function getKeyColumns(detail: string) {
  const match = /^Key \((.+?)\)=/.exec(detail)
  return match
    ? match[1]!.split(/,\s*/).map(column => column.replace(/^"|"$/g, ''))
    : []
}

// A column without a property, such as a key on an expression, gives none:
function getProperties(meta: EntityMetadata, columns: (string | undefined)[]) {
  const props = columns.map(column =>
    meta.props.find(prop => column && prop.fieldNames?.includes(column))
  )
  return props.every(Boolean) ? (props as EntityProperty[]) : []
}
