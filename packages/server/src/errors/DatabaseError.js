import { WrappedError } from './WrappedError'
import {
  DBError,
  DataError,
  CheckViolationError,
  NotNullViolationError,
  ConstraintViolationError
} from 'db-errors' // TODO: 'objection' doesn't work! submit a test-case.

export class DatabaseError extends WrappedError {
  constructor(error, overrides) {
    const status =
      error instanceof CheckViolationError ? 400
      : error instanceof NotNullViolationError ? 400
      : error instanceof ConstraintViolationError ? 409
      : error instanceof DataError ? 400
      : error instanceof DBError ? 500
      : 400
    overrides = { type: error.constructor.name, status, ...overrides }
    super(error, overrides, { message: 'Database error', status })
  }
}
