import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import { isObject, isString } from '@ditojs/utils'
import type { Plugin, Problem } from './types.ts'

// Errors become RFC 9457 Problem Details. Validation errors carry `errors`,
// keyed by the JSON Pointer of the invalid value, such as `/sets/8/name`.
// Errors that no part of the app knows are logged and answer a plain 500.

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

  constructor({
    status,
    title = getStatusTitle(status),
    detail,
    errors,
    type
  }: Omit<Problem, 'title'> & { title?: string }) {
    super(detail ?? title)
    this.name = 'ProblemError'
    this.status = status
    this.title = title
    this.detail = detail
    this.errors = errors
    this.type = type
  }

  toProblem(): Problem {
    const { type, title, status, detail, errors } = this
    return { type, title, status, detail, errors }
  }
}

export function createValidationError(
  target: 'query' | 'json',
  issues: readonly StandardSchemaV1.Issue[]
) {
  const errors: NonNullable<Problem['errors']> = {}
  for (const issue of issues) {
    // Zod's issues carry a `code`, which other libraries may not.
    const { code } = issue as { code?: unknown }
    ;(errors[toJsonPointer(issue.path)] ??= []).push({
      message: issue.message,
      ...(isString(code) && { keyword: code as string })
    })
  }
  return new ProblemError({
    status: 400,
    title: 'Validation Failed',
    detail: `The ${target === 'json' ? 'body' : 'query'} is not valid.`,
    errors
  })
}

export function toJsonPointer(path: StandardSchemaV1.Issue['path'] = []) {
  return path
    .map(segment => {
      const key = isObject(segment) ? segment.key : segment
      return `/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`
    })
    .join('')
}

export function toProblem(error: unknown, plugins: Plugin[]): Problem {
  if (error instanceof ProblemError) return error.toProblem()
  if (error instanceof HTTPException) {
    return {
      title: getStatusTitle(error.status),
      status: error.status,
      detail: error.message || undefined
    }
  }
  for (const plugin of plugins) {
    const problem = plugin.toProblem?.(error)
    if (problem) return problem
  }
  console.error(error)
  return { title: getStatusTitle(500), status: 500 }
}

export function respondProblem(c: Context, problem: Problem) {
  return c.body(JSON.stringify(problem), problem.status as never, {
    'Content-Type': 'application/problem+json'
  })
}
