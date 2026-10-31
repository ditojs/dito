import { HttpError } from '@ditojs/server-next'

// The errors of the auth actions, as Problem Details with the message as
// `detail`, which the admin shows.
export function authError(
  detail: string,
  status = 401,
  members: Record<string, unknown> = {}
) {
  return new HttpError(status, { detail, ...members })
}
