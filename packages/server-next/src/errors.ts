import type { StandardSchemaV1 } from '@standard-schema/spec'
import { isObject, isString } from '@ditojs/utils'
import type { Problem } from './types.ts'

// Errors become RFC 9457 Problem Details. An `HttpError` is meant for the
// client, which gets its detail and members. Other errors answer a bare 500.
// Validation errors carry `errors`, keyed by the JSON Pointer of the invalid
// value, such as `/sets/8/name`. Nothing here logs: the app does in the
// `onError` of `createApp()`.

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

export function getStatusTitle(status: number) {
  return titles[status] ?? (status < 500 ? 'Client Error' : 'Server Error')
}

export interface HttpErrorOptions {
  title?: string
  detail?: string
  errors?: Problem['errors']
  type?: string
  // The error that caused this one, for the app's logs.
  cause?: unknown
  // Extension members of the problem.
  [member: string]: unknown
}

export class HttpError extends Error {
  status: number
  title: string
  detail: string | undefined
  errors: Problem['errors']
  type: string | undefined
  members: Record<string, unknown>

  constructor(
    status: number,
    { title, detail, errors, type, cause, ...members }: HttpErrorOptions = {}
  ) {
    title ??= getStatusTitle(status)
    super(detail ?? title, { cause })
    this.name = 'HttpError'
    this.status = status
    this.title = title
    this.detail = detail
    this.errors = errors
    this.type = type
    this.members = members
  }

  toProblem(): Problem {
    const { type, title, status, detail, errors } = this
    return { ...this.members, type, title, status, detail, errors }
  }
}

// A validation issue of Standard Schema. Zod's issues also carry a `code`.
export interface ValidationIssue extends StandardSchemaV1.Issue {
  readonly code?: unknown
}

// A 400 for the issues of the query, the body or a model's data.
export function createValidationError(
  issues: readonly ValidationIssue[],
  detail = 'The data is not valid.'
) {
  return new HttpError(400, {
    title: 'Validation Failed',
    detail,
    errors: toProblemErrors(issues)
  })
}

// The `errors` of a problem, keyed by JSON Pointer.
export function toProblemErrors(issues: readonly ValidationIssue[]) {
  const errors: NonNullable<Problem['errors']> = {}
  for (const { message, path, code } of issues) {
    ;(errors[toJsonPointer(path)] ??= []).push({
      message,
      ...(isString(code) && { code: code as string })
    })
  }
  return errors
}

// The JSON Pointer of a path, `''` for the value itself.
export function toJsonPointer(
  path: StandardSchemaV1.Issue['path'] | string[] = []
) {
  return path
    .map(segment => {
      const key = isObject(segment) ? segment.key : segment
      return `/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`
    })
    .join('')
}

export function toProblem(error: unknown): Problem {
  return error instanceof HttpError
    ? error.toProblem()
    : { title: getStatusTitle(500), status: 500 }
}

// The Problem Details response of an error. A `Response` that was thrown is
// sent as it is.
export function problemResponse(error: unknown) {
  if (error instanceof Response) return error
  const problem = toProblem(error)
  return Response.json(problem, {
    status: problem.status,
    headers: { 'Content-Type': 'application/problem+json' }
  })
}
