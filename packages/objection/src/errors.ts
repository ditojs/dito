import { HttpError, toJsonPointer, type Problem } from '@ditojs/server-next'
import { DatabaseError, ResponseError } from '@ditojs/server'
import { asArray, isPlainObject, isString } from '@ditojs/utils'
import { DBError, NotFoundError, wrapError } from 'objection'

// Maps Dito 6's and Objection's errors to an `HttpError`, and other errors to
// undefined, for the `onError` of `createApp()`. The problem has the status
// and the message as `detail`. Validation errors carry `errors` by JSON
// Pointer, with Dito 6's `keyword` as `code`. Errors that aren't exposed to
// the client answer their status only. The original error is the `cause`.

type DitoErrors = Record<
  string,
  { message: string; keyword?: string; params?: Record<string, unknown> }[]
>

export function toProblem(error: unknown): HttpError | undefined {
  // Objection wraps the errors of the database drivers that knex throws.
  const dbError = error instanceof Error ? wrapError(error) : undefined
  if (dbError instanceof DBError) {
    return toProblem(
      new DatabaseError(dbError, { message: getMessage(dbError) })
    )
  }
  if (error instanceof NotFoundError) {
    return new HttpError(404, { cause: error })
  }
  if (!(error instanceof ResponseError)) return undefined
  const { status = 500 } = error
  if (!(error.expose ?? true)) return new HttpError(status, { cause: error })
  const errors = toProblemErrors(error.data?.errors)
  return new HttpError(status, {
    ...(errors && { title: 'Validation Failed' }),
    detail: error.message,
    errors,
    cause: error
  })
}

// Dito 6 keys errors by data path, such as `sets/8/name`, and reports a
// missing property on the object that lacks it.
function toProblemErrors(errors: unknown) {
  if (!isPlainObject(errors)) return undefined
  const result: NonNullable<Problem['errors']> = {}
  for (const [path, items] of Object.entries(errors as DitoErrors)) {
    for (const { message, keyword, params } of asArray(items)) {
      const segments = path ? path.split('/') : []
      const missing = keyword === 'required' && params?.missingProperty
      if (isString(missing)) segments.push(missing as string)
      ;(result[toJsonPointer(segments)] ??= []).push({
        message,
        ...(isString(keyword) && { code: keyword })
      })
    }
  }
  return Object.keys(result).length ? result : undefined
}

// Knex puts the SQL before the database's message, as `<sql> - <message>`.
function getMessage(error: Error) {
  return error.message.match(/^[\s\S]* - ([\s\S]*?)$/)?.[1] ?? error.message
}
