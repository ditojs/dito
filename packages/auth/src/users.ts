import type { User } from '@ditojs/server'
import type { createEntityUserSource } from '@ditojs/mikro/internal'

// The values of the user entities that auth reads, beside `id` and `roles`.
export interface AuthUser extends User {
  // The bcrypt hash, or null for users without a password. Sources load it,
  // as sessions end when it changes.
  hash?: string | null
  // A login changes it, which ends password reset links. Entities without this
  // property don't record logins.
  lastLogin?: Date | string | null
}

export type UserSource<U extends AuthUser = AuthUser> = ReturnType<
  typeof createEntityUserSource<U>
>

// Sessions and credentials name users by their source and id, as `Admin-1`,
// so several sources can share them.
export function getUserIdentifier(source: UserSource<any>, user: AuthUser) {
  return `${source.name}-${user.id}`
}

// Split at the first hyphen only, as ids may hold hyphens, as UUIDs do.
export function parseUserIdentifier(identifier: unknown) {
  const match = String(identifier).match(/^([^-]+)-(.+)$/)
  return match ? { name: match[1], id: match[2] } : null
}
