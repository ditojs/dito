import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import { isObject, isString } from '@ditojs/utils'
import type { ErrorFormat, Problem } from './types.ts'

// Errors become RFC 9457 Problem Details. Validation errors carry `errors`,
// keyed by the JSON Pointer of the invalid value, such as `/sets/8/name`, or
// by its data path in Dito 6's format.
// Other errors answer a bare 500. Nothing here logs: the app passes
// `problemResponse` to Hono's `app.onError()` and logs there itself.

const titles: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Content Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  503: 'Service Unavailable'
}

export function getStatusTitle(status: number) {
  return titles[status] ?? (status < 500 ? 'Client Error' : 'Server Error')
}

export class ProblemError extends Error {
  status: number
  title: string
  detail: string | undefined
  errors: Problem['errors']
  type: string | undefined
  extensions: Record<string, unknown>

  constructor({
    status,
    title = getStatusTitle(status),
    detail,
    errors,
    type,
    ...extensions
  }: Partial<Problem> & { status: number }) {
    super(detail ?? title)
    this.name = 'ProblemError'
    this.status = status
    this.title = title
    this.detail = detail
    this.errors = errors
    this.type = type
    this.extensions = extensions
  }

  toProblem(): Problem {
    const { type, title, status, detail, errors } = this
    return { ...this.extensions, type, title, status, detail, errors }
  }
}

// A validation issue of Standard Schema. Zod's issues also carry a `code`.
export interface ValidationIssue extends StandardSchemaV1.Issue {
  readonly code?: unknown
}

// What failed validation: the query or the body of an action, or the data of
// a model, which ORM packages validate.
export type ValidationTarget = 'query' | 'json' | 'model'

const messages = {
  problem: {
    query: 'The query is not valid.',
    json: 'The body is not valid.',
    model: 'The data is not valid.'
  },
  // Dito 6's messages, which its admin shows.
  dito: {
    query: 'The provided action parameters are not valid',
    json: 'The provided action parameters are not valid',
    model: 'The provided data is not valid'
  }
}

// A 400 for the issues. The `problem` format keys `errors` by JSON Pointer.
// The `dito` format answers in Dito 6's shape, which its admin reads: `type`
// and `message`, and `errors` keyed by data paths, see `toDitoErrors()`.
export function createValidationError(
  target: ValidationTarget,
  issues: readonly ValidationIssue[],
  { format = 'problem' }: { format?: ErrorFormat } = {}
) {
  const detail = messages[format][target]
  if (format === 'dito') {
    return new ProblemError({
      status: 400,
      detail,
      type: target === 'model' ? 'ModelValidation' : 'ParameterValidation',
      message: detail,
      errors: toDitoErrors(issues)
    })
  }
  return new ProblemError({
    status: 400,
    title: 'Validation Failed',
    detail,
    errors: getErrors(issues, toJsonPointer)
  })
}

// The errors of the issues in Dito 6's shape, keyed by data paths such as
// `sets/8/name`, and the empty path for the value itself.
export function toDitoErrors(issues: readonly ValidationIssue[]) {
  return getErrors(issues, toDataPath)
}

function getErrors(
  issues: readonly ValidationIssue[],
  getKey: (path: StandardSchemaV1.Issue['path']) => string
) {
  const errors: NonNullable<Problem['errors']> = {}
  for (const { message, path, code } of issues) {
    ;(errors[getKey(path)] ??= []).push({
      message,
      ...(isString(code) && { keyword: code as string })
    })
  }
  return errors
}

function toDataPath(path: StandardSchemaV1.Issue['path'] = []) {
  return path
    .map(segment => String(isObject(segment) ? segment.key : segment))
    .join('/')
}

export function toJsonPointer(path: StandardSchemaV1.Issue['path'] = []) {
  return path
    .map(segment => {
      const key = isObject(segment) ? segment.key : segment
      return `/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`
    })
    .join('')
}

export function toProblem(error: unknown): Problem {
  if (error instanceof ProblemError) return error.toProblem()
  if (error instanceof HTTPException) {
    return {
      title: getStatusTitle(error.status),
      status: error.status,
      detail: error.message || undefined
    }
  }
  return { title: getStatusTitle(500), status: 500 }
}

// The Problem Details response of an error, for Hono's `app.onError()`. An
// `HTTPException` with a response of its own sends that response.
export function problemResponse(error: unknown, c: Context) {
  if (error instanceof HTTPException && error.res) return error.res
  const problem = toProblem(error)
  return c.body(JSON.stringify(problem), problem.status as never, {
    'Content-Type': 'application/problem+json'
  })
}
