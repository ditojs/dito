import type { Context, ErrorHandler, NotFoundHandler } from 'hono'
import { isNumber, isString } from '@ditojs/utils'
import type { DbAdapter, ErrorLogger, HttpErrorBody } from './types.ts'

// Errors respond with JSON: `{ type, message, status, code, errors }`. An
// `HttpError` is meant for the client, which gets its message and data. Other
// errors with a numeric `status`, such as those of http-errors, respond with
// that status, and with their message when `expose` is true, by default below
// 500. All other errors respond with 500. Errors with a status of 500 or above
// go to the `onError` hook of `createApi()` and `errorHandler()`, which by
// default logs them through `c.var.logger`, any object with `error()`, else
// `console`.

const titles: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  412: 'Precondition Failed',
  413: 'Content Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  428: 'Precondition Required',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  503: 'Service Unavailable'
}

function getStatusTitle(status: number) {
  return titles[status] ?? (status < 500 ? 'Client Error' : 'Server Error')
}

interface HttpErrorOptions {
  // Default: the title of the status, such as `Not Found`.
  message?: string
  // The kind of error, such as `ModelValidation`.
  type?: string
  code?: string
  errors?: HttpErrorBody['errors']
  // The error that caused this one, for the app's logs.
  cause?: unknown
  // More data of the body.
  [key: string]: unknown
}

export class HttpError extends Error {
  status: number
  type: string | undefined
  code: string | undefined
  errors: HttpErrorBody['errors']
  data: Record<string, unknown>

  constructor(
    status: number,
    { message, type, code, errors, cause, ...data }: HttpErrorOptions = {}
  ) {
    super(message ?? getStatusTitle(status), { cause })
    this.name = 'HttpError'
    this.status = status
    this.type = type
    this.code = code
    this.errors = errors
    this.data = data
  }

  toJSON(): HttpErrorBody {
    const { type, message, status, code, errors } = this
    return { ...this.data, type, message, status, code, errors }
  }
}

// A validation issue, as Zod reports it.
export interface ValidationIssue {
  readonly message: string
  readonly path?: readonly PropertyKey[]
  readonly code?: unknown
}

export interface ValidationErrorOptions {
  // Default: `The data is not valid.`
  message?: string
  // Default: `ModelValidation`.
  type?: string
  // Default: 400.
  status?: number
  cause?: unknown
}

// The options of `createValidationError()` for a query and a body.
export const queryValidation = {
  message: 'The query is not valid.',
  type: 'ParameterValidation'
}
export const bodyValidation = {
  message: 'The body is not valid.',
  type: 'BodyValidation'
}

// The error of the issues of the query, the body or a model's data.
export function createValidationError(
  issues: readonly ValidationIssue[],
  {
    message = 'The data is not valid.',
    type = 'ModelValidation',
    status = 400,
    cause
  }: ValidationErrorOptions = {}
) {
  return new HttpError(status, {
    type,
    message,
    errors: toFieldErrors(issues),
    cause
  })
}

// The errors of the fields, keyed by their path, such as `chapters/8/title`,
// and `''` for the value itself. The code of an issue becomes its `keyword`.
function toFieldErrors(issues: readonly ValidationIssue[]) {
  const errors: NonNullable<HttpErrorBody['errors']> = {}
  for (const { message, path = [], code } of issues) {
    const key = path.map(String).join('/')
    ;(errors[key] ??= []).push({
      message,
      ...(isString(code) && { keyword: code })
    })
  }
  return errors
}

// The `HttpError` of an error with a numeric `status` between 400 and 599,
// or `undefined`. An `HttpError` is returned as it is.
function toStatusError(error: unknown) {
  if (error instanceof HttpError) return error
  const { status, expose, message } = (error ?? {}) as {
    status?: unknown
    expose?: boolean
    message?: string
  }
  if (!isNumber(status) || status < 400 || status > 599) return undefined
  return new HttpError(status, {
    message: ((expose ?? status < 500) && message) || undefined,
    cause: error
  })
}

function logError(error: unknown, c: Context) {
  const { logger = console } = c.var as { logger?: Pick<Console, 'error'> }
  logger.error(error)
}

// The headers of a response that describe its data. Names are in lower case.
const dataHeaders = /^(content-(?!security-)|etag$|cache-control$|location$)/

// The error handler of Hono apps, which hosts pass to `app.onError()` for the
// errors outside of APIs, such as those of their own middleware. `onError` gets
// the errors with a status of 500 or above. The response keeps the headers that
// were set before the error, such as cookies and those of `cors()`, except the
// ones that describe the data.
export function errorHandler(
  onError: ErrorLogger = logError,
  toHttpError?: DbAdapter['toHttpError']
): ErrorHandler {
  return async (error, c) => {
    const httpError = toStatusError(toHttpError?.(error, c as never) ?? error)
    const body = (httpError ?? new HttpError(500)).toJSON()
    if (body.status >= 500) await onError(error, c)
    const response = Response.json(body, { status: body.status })
    const { headers } = c.res
    // Hono adds the headers of the current response to the one returned here,
    // but not when the error comes from the only handler of a route. So this
    // copies them and drops the current response.
    c.res = undefined
    for (const [name, value] of headers) {
      if (!dataHeaders.test(name)) response.headers.append(name, value)
    }
    return response
  }
}

// The handler of `app.notFound()`. `errorHandler()` handles its error.
export const notFound: NotFoundHandler = () => {
  throw new HttpError(404)
}
