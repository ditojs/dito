import { ProblemError } from '@ditojs/server-next'

// Problems with the `message` that Dito 6's errors carry, which the admin
// shows.
export function authError(
  message: string,
  status = 401,
  extensions: Record<string, unknown> = {}
) {
  return new ProblemError({ status, detail: message, message, ...extensions })
}

export function validationError(field: string, message: string) {
  return new ProblemError({
    status: 400,
    title: 'Validation Failed',
    detail: 'The body is not valid.',
    message,
    errors: { [`/${field}`]: [{ message, keyword: 'required' }] }
  })
}
