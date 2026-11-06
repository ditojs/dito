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

// The users of one kind, from `createEntityUserSource()` of `@ditojs/mikro`.
export interface UserSource<U extends User = User> {
  // The users' prefix in sessions and credentials, as in `'<name>-<id>'`.
  name: string
  // Resolve to null for ids that it can't read, as from tampered tokens.
  findById(id: string): Promise<U | null | undefined>
  findByUsername(username: string): Promise<U | null | undefined>
  // Store the values and set them on `user`: the new hash, or the time of a
  // login.
  patch(user: U, values: { hash?: string; lastLogin?: Date }): Promise<void>
  serialize(user: U): unknown
  // The property of the username in the bodies of the users' model
  // controllers. Default: `username`.
  usernameProperty?: string
  // The schema of new passwords, for `users.defineActions()` and the users'
  // model controllers. At least 8 characters by default.
  password?: z.ZodType<string>
}

// Sessions and credentials name users by their source and id, as `Admin-1`,
// so several sources can share them.
export function getUserIdentifier(source: UserSource<any>, user: User) {
  return `${source.name}-${user.id}`
}

// Split at the first hyphen only, as ids may hold hyphens, as UUIDs do.
export function parseUserIdentifier(identifier: unknown) {
  const match = String(identifier).match(/^([^-]+)-(.+)$/)
  return match ? { name: match[1], id: match[2] } : null
}
