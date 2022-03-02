import { WrappedError } from './WrappedError'
import {
  DBError,
  DataError,
  CheckViolationError,
  NotNullViolationError,
  ConstraintViolationError
} from 'objection'

export class DatabaseError extends WrappedError {
  constructor(error) {
    const status =
      error instanceof CheckViolationError ? 400
      : error instanceof NotNullViolationError ? 400
      : error instanceof ConstraintViolationError ? 409
      : error instanceof DataError ? 400
      : error instanceof DBError ? 500
      : 400
    // Remove knex SQL query and move to separate `query` property.
    // TODO: Fix this properly in Knex / Objection instead, see:
    // https://gitter.im/Vincit/objection.js?at=5a68728f5a9ebe4f75ca40b0
    const [, sql, message] = error.message.match(/^([\s\S]*) - ([\s\S]*?)$/) ||
      [null, null, error.message]
    const overrides = {
      type: error.constructor.name,
      message,
      status
    }
    if (process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'test') {
      overrides.sql = sql
    }
    super(error, overrides, { message: 'Database error', status })
  }
}
