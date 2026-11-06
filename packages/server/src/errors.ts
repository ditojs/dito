import type { Context, ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { isNumber, isString } from '@ditojs/utils'
import type { Adapter, ErrorLogger, HttpErrorBody } from './types.ts'

// Errors respond with JSON: `{ type, message, status, code, errors }`. Those
// with a status of 500 or above also go to `onError`.
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

// The headers that describe a response's data, which errors don't keep. Hono
// gives their names in lower case.
const dataHeaders = /^(content-(?!security-)|etag$|cache-control$|location$)/

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

  constructor(status: number, options: string | HttpErrorOptions = {}) {
    const { message, type, code, errors, cause, ...data } = isString(options)
      ? { message: options }
      : options
    super(
      message ??
      titles[status] ??
      (status < 500 ? 'Client Error' : 'Server Error'),
      { cause }
    )
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

export interface CreateValidationErrorOptions {
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
  }: CreateValidationErrorOptions = {}
) {
  return new HttpError(status, {
    type,
    message,
    errors: getFieldErrors(issues),
    cause
  })
}

// Answer the errors of `createApi()` and `createHono()`, also those of the
// app's own middleware.
export function createErrorHandler({
  onError = logError,
  toHttpError
}: {
  onError?: ErrorLogger
  toHttpError?: Adapter['toHttpError']
} = {}): ErrorHandler {
  return async (error, c) => {
    const httpError = convertStatusError(toHttpError?.({ error, c }) ?? error)
    const body = (httpError ?? new HttpError(500)).toJSON()
    if (body.status >= 500) await onError({ error, c })
    const response = Response.json(body, { status: body.status })
    // Keep the headers set before the error, such as cookies and those of
    // `cors()`, and those of an `HTTPException`, such as `WWW-Authenticate`:
    const headers = [
      ...c.res.headers,
      ...(error instanceof HTTPException ? (error.res?.headers ?? []) : [])
    ]
    // Hono adds them itself, except for errors of a route's only handler, so
    // copy them and drop the current response.
    c.res = undefined
    for (const [name, value] of headers) {
      if (!dataHeaders.test(name)) response.headers.append(name, value)
    }
    return response
  }
}

// Answer unknown paths in `createHono()`. It responds instead of throwing, so
// that the middleware that runs last still gets the response after `next()`.
export const notFound: NotFoundHandler = c =>
  c.json(new HttpError(404).toJSON(), 404)

function getFieldErrors(issues: readonly ValidationIssue[]) {
  const errors: NonNullable<HttpErrorBody['errors']> = {}
  for (const { message, path = [], code } of issues) {
    // Key the errors by path, such as `chapters/8/title`, and by `''` for the
    // value itself:
    const key = path.map(String).join('/')
    ;(errors[key] ??= []).push({
      message,
      ...(isString(code) && { keyword: code })
    })
  }
  return errors
}

// Convert errors with a numeric `status` between 400 and 599, such as those of
// http-errors. Their message is exposed if `expose` is true, by default below
// 500.
function convertStatusError(error: unknown) {
  const { status, expose, message } = (error ?? {}) as {
    status?: unknown
    expose?: boolean
    message?: string
  }
  return error instanceof HttpError
    ? error
    : isNumber(status) && status >= 400 && status <= 599
      ? new HttpError(status, {
          message: ((expose ?? status < 500) && message) || undefined,
          cause: error
        })
      : undefined
}

function logError({ error }: { error: unknown }) {
  console.error(error)
}
