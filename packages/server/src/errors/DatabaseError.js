import { ResponseError } from './ResponseError.js'
import {
  DBError,
  DataError,
  CheckViolationError,
  NotNullViolationError,
  ConstraintViolationError
} from 'objection'

export class DatabaseError extends ResponseError {
  constructor(error, overrides) {
    super(
      error,
      {
        type: error.constructor.name,
        message: 'Database error',
        status: getStatus(error),
        cause: error.nativeError
      },
      overrides
    )
    // Only violations describe the request's data, other database errors are
    // internal:
    if (this.status >= 500) {
      this.expose ??= false
    }
  }
}

function getStatus(error) {
  return error instanceof CheckViolationError
    ? 400
    : error instanceof NotNullViolationError
      ? 400
      : error instanceof ConstraintViolationError
        ? 409
        : error instanceof DataError
          ? 400
          : error instanceof DBError
            ? 500
            : 400
}
