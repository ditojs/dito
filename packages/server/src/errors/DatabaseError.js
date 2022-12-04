import { ResponseError } from './ResponseError.js'
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

export class DatabaseError extends ResponseError {
  constructor(error, overrides) {
    super(error, {
      type: error.constructor.name,
      message: 'Database error',
      status: getStatus(error)
    }, overrides)
  }
}

function getStatus(error) {
  return error instanceof CheckViolationError ? 400
    : error instanceof NotNullViolationError ? 400
    : error instanceof ConstraintViolationError ? 409
    : error instanceof DataError ? 400
    : error instanceof DBError ? 500
    : 400
}
