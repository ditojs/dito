import { createHash } from 'node:crypto'
import { HttpError } from '@ditojs/server'
import type { User, UserSource } from './types.ts'

// The time to complete passkey challenges, to confirm new TOTP secrets and to
// complete the logins of users with TOTP.
export const authenticationTimeout = 5 * 60 * 1000

// The errors of the auth actions, whose message the admin shows.
export function authError(
  message: string,
  status = 401,
  data: Record<string, unknown> = {}
) {
  return new HttpError(status, { message, ...data })
}

// Sessions and credentials name users by their source and id, such as
// `Admin-1`, so several sources can share them.
export function getUserIdentifier(source: UserSource<any>, user: User) {
  return `${source.name}-${user.id}`
}

// Splits at the first hyphen only, as ids may hold hyphens, such as UUIDs.
export function parseUserIdentifier(identifier: unknown) {
  const match = String(identifier).match(/^([^-]+)-(.+)$/)
  return match ? { name: match[1], id: match[2] } : null
}

// Sessions keep a hash of the password hash, so a password change ends the
// other sessions of the user.
export function getPasswordFingerprint(hash: string | null | undefined) {
  return hash ? createHash('sha256').update(hash).digest('base64url') : null
}
