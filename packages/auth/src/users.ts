import type { Context } from 'hono'
import type { z } from 'zod'

// The values that auth reads from users.
export interface User {
  id: number | string
  username?: string | null
  // The bcrypt hash, or null for users without a password. Sources load it,
  // as sessions end when it changes.
  hash?: string | null
  roles?: string[] | null
  // A login changes it, which ends password reset links.
  lastLogin?: Date | string | null
}

// The users of one kind, such as admins or customers.
// `createEntityUserSource()` of `@ditojs/mikro` returns one for an entity, or
// the app implements it.
// `name` names the users in sessions and credentials, as `'<name>-<id>'`, such
// as `Admin-1`.
export interface UserSource<U extends User = User> {
  name: string
  // Resolves to null for ids it can't read, such as those of tampered tokens.
  findById(c: Context, id: string): Promise<U | null | undefined>
  findByUsername(
    c: Context,
    username: string
  ): Promise<U | null | undefined>
  // Stores the values and sets them on `user`: the new hash, or the time of
  // a login.
  patch(
    c: Context,
    user: U,
    values: { hash?: string; lastLogin?: Date }
  ): Promise<void>
  serialize(c: Context, user: U): unknown
  // The property of the username in the bodies of writes, for
  // `definePasswordWrites()`. Default: `username`.
  usernameProperty?: string
  // The schema of new passwords, for `defineUserActions()` and
  // `definePasswordWrites()`. At least 8 characters by default.
  password?: z.ZodType<string>
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
