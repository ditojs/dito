import { HttpError } from '@ditojs/server'

// The time to complete passkey challenges, to confirm new TOTP secrets and to
// complete the logins of users with TOTP.
export const authenticationTimeout = 5 * 60 * 1000

// The errors of the auth actions, whose message the admin shows.
export function createAuthError(
  message: string,
  status = 401,
  data: Record<string, unknown> = {}
) {
  return new HttpError(status, { message, ...data })
}
