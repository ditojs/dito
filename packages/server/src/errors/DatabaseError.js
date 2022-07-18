import { WrappedError } from './WrappedError.js'
// TODO: Import directly once we can move to Objection 3 and this is fixed:
// import {
//   DBError,
//   DataError,
//   CheckViolationError,
//   NotNullViolationError,
//   ConstraintViolationError
// } from 'objection'
import objection from 'objection'
const {
  DBError,
  DataError,
  CheckViolationError,
  NotNullViolationError,
  ConstraintViolationError
} = objection

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
