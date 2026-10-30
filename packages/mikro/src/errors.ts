import {
  ProblemError,
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

// Errors in the shape that Dito 6's admin reads, as `@ditojs/objection`
// answers them: `type` and `message` for its notifications, and on a 400 the
// `errors` of the fields, keyed by Dito 6's data paths such as `sets/1/name`.

export interface FieldError {
  path: readonly PropertyKey[]
  message: string
  code?: string
}

// A 400 for invalid data, as Dito 6's `ModelValidation` errors. The empty
// path stands for the whole row.
export function createValidationError(fieldErrors: FieldError[]) {
  return createCoreValidationError('model', fieldErrors, { format: 'dito' })
}

// Maps MikroORM's errors to a `ProblemError`, and other errors to undefined.
// Violations describe the request's data, as in Dito 6's `DatabaseError`.
// Other database errors are internal and answer their status only.
export function toProblem(error: unknown) {
  if (error instanceof NotFoundError) {
    return new ProblemError({ status: 404, detail: error.message })
  }
  if (error instanceof OptimisticLockError) {
    return databaseError(error, 409)
  }
  if (error instanceof DriverException) {
    const status =
      (
        error instanceof NotNullConstraintViolationException ||
        error instanceof CheckConstraintViolationException ||
        // Postgres' data exceptions, such as a value out of range.
        (error.sqlState ?? error.code)?.startsWith('22')
      )
        ? 400
        : error instanceof ConstraintViolationException
          ? 409
          : 500
    return status < 500
      ? databaseError(error, status)
      : new ProblemError({ status })
  }
  return undefined
}

function databaseError(error: Error, status: number) {
  const message = 'Database error'
  return new ProblemError({
    status,
    detail: message,
    type: error.constructor.name,
    message
  })
}
