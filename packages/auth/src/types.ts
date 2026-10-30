import type { Context } from 'hono'
import type { Kysely } from 'kysely'

// Any Hono context. The package reads the request and sets cookies, so it
// needs no variables of its own.
export type AnyContext = Context<any, any, any>

// The database of a request, such as the root Kysely instance or the
// request's transaction.
export type Database = (c: AnyContext) => Kysely<any>

export interface UserDescription {
  id: number | string
  username: string
  // The bcrypt hash, or null for users without a password.
  hash: string | null | undefined
  roles: string[]
  // A login changes it, which ends password reset links.
  lastLogin?: Date | string | null
}

// The users of one kind, such as admins or customers. The app implements it
// with its own ORM. `name` names the users in sessions and credentials, as
// `'<name>-<id>'`, and matches the model name of Dito 6.
export interface UserSource<U = any> {
  name: string
  // The body field of the username in logins and password resets.
  usernameField?: string
  // Resolves to null for ids it can't read, such as those of tampered tokens.
  findById(c: AnyContext, id: string): Promise<U | null | undefined>
  findByUsername(c: AnyContext, username: string): Promise<U | null | undefined>
  describe(user: U): UserDescription
  setPassword(c: AnyContext, user: U, hash: string): Promise<void>
  // Stores the time of the login, as Dito 6's `lastLogin`.
  touchLogin?(c: AnyContext, user: U): Promise<void>
  // Updates the user's own values, for `PATCH self`. It validates them. The
  // password never reaches it.
  update?(c: AnyContext, user: U, values: Record<string, unknown>): Promise<U>
  toJSON(c: AnyContext, user: U): unknown
}

// The value of a session, as Dito 6 stores it.
export interface SessionValue {
  [key: string]: any
  passport?: { user: string; passwordFingerprint?: string | null }
  confirmedAccess?: { user: string; expires: number }
  pendingLogin?: { user: string; expires: number }
}
