import type { UserSource } from './types.ts'

// The time to answer passkey challenges, to confirm new TOTP secrets and to
// complete the logins of users with TOTP.
export const authenticationTimeout = 5 * 60 * 1000

// Sessions name users by their source and id, such as `Admin-1`.
export function getUserIdentifier(source: UserSource, user: unknown) {
  return `${source.name}-${source.describe(user).id}`
}

// Splits at the first hyphen only, as ids may hold hyphens, such as UUIDs.
export function parseUserIdentifier(identifier: unknown) {
  const match = String(identifier).match(/^([^-]+)-(.+)$/)
  return match ? { name: match[1], id: match[2] } : null
}
