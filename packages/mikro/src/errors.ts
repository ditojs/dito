import {
  HttpError,
  createValidationError as createCoreValidationError
} from '@ditojs/server-next'
import {
  CheckConstraintViolationException,
  ConstraintViolationException,
  DriverException,
  NotFoundError,
  NotNullConstraintViolationException,
  OptimisticLockError
} from '@mikro-orm/core'

// The errors of MikroORM as `HttpError`s, and the 400 for invalid data of a
// model, whose `errors` are keyed by JSON Pointer, such as `/sets/1/name`.

export interface FieldError {
  path: readonly PropertyKey[]
  message: string
  code?: string
}

// A 400 for invalid data. The empty path stands for the whole row.
export function createValidationError(fieldErrors: readonly FieldError[]) {
  return createCoreValidationError(fieldErrors)
}

// Maps MikroORM's errors to an `HttpError`, and other errors to undefined,
// for the app's `onError`. Violations describe the request's data. Other
// database errors are internal and answer a bare 500.
export function toProblem(error: unknown) {
  if (error instanceof NotFoundError) {
    return new HttpError(404, { cause: error })
  }
  if (error instanceof OptimisticLockError) {
    return new HttpError(409, {
      detail: 'A more recent version exists in the database.',
      cause: error
    })
  }
  if (error instanceof DriverException) {
    if (
      error instanceof NotNullConstraintViolationException ||
      error instanceof CheckConstraintViolationException ||
      // Postgres' data exceptions, such as a value out of range.
      (error.sqlState ?? error.code)?.startsWith('22')
    ) {
      return new HttpError(400, {
        detail: 'The data is not valid for the database.',
        cause: error
      })
    }
    if (error instanceof ConstraintViolationException) {
      return new HttpError(409, {
        detail: 'The data conflicts with rows in the database.',
        cause: error
      })
    }
    return new HttpError(500, { cause: error })
  }
  return undefined
}
