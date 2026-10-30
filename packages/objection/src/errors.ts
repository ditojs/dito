import { ProblemError, type Problem } from '@ditojs/server-next'
import { ResponseError } from '@ditojs/server'

// Maps Dito 6's errors to a `ProblemError`, and other errors to undefined.
// The problem keeps the JSON that the admin reads: `type` and `message` for
// its notifications, and on a 400 the `errors` of the fields, keyed by Dito
// 6's data paths such as `sets/8/name`, not by JSON Pointers. Errors that
// aren't exposed to the client answer their status only.
export function toProblem(error: unknown) {
  if (!(error instanceof ResponseError)) return undefined
  const { status = 500 } = error
  if (!(error.expose ?? true)) return new ProblemError({ status })
  const { message, type, errors, ...data } = error.toJSON() as {
    message: string
    type?: string
    errors?: Problem['errors']
  }
  return new ProblemError({
    ...data,
    status,
    detail: message,
    type,
    errors,
    message
  })
}
