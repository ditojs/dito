import { createHash, randomUUID } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { getContext } from 'hono/context-storage'
import {
  deleteCookie,
  getSignedCookie,
  setSignedCookie as setHonoSignedCookie
} from 'hono/cookie'
import type { CookieOptions } from 'hono/utils/cookie'
import type { Kysely } from 'kysely'
import { isEmpty, parseDuration } from '@ditojs/utils'
import type { Adapter } from '@ditojs/server'
import { createAuthError } from './authentication.ts'
import {
  getUserIdentifier,
  parseUserIdentifier,
  type User,
  type UserSource
} from './users.ts'

// Sessions in the `session` table, with their id in a signed cookie.

declare module 'hono' {
  interface ContextVariableMap {
    session: Session
  }
}

export interface CreateSessionsOptions {
  // The adapter of the API, such as `createMikroAdapter(orm)`, for the
  // `session` table. Sessions load before and save after the actions, so they
  // use its Kysely outside of the request's transaction.
  adapter: Adapter
  // The secrets that sign the cookie. The first one signs, and all of them
  // verify, so secrets can rotate.
  secrets: string[]
  // The cookie name, such as `admin.sess`.
  cookieName: string
  // In milliseconds or as a duration such as `'24h'`.
  maxAge: number | string
  // The source of the users that log in to these sessions.
  source: UserSource<any>
}

// The options with `maxAge` parsed.
interface SessionOptions extends CreateSessionsOptions {
  maxAge: number
}

// The value of a session, stored as JSON. The app may add its own keys.
interface SessionValue {
  [key: string]: any
  // The user and the fingerprint of their password.
  passport?: { user: string; passwordFingerprint: string | null }
  confirmedAccess?: { user: string; expires: number }
  pendingLogin?: { user: string; expires: number }
}

interface LoadedSession {
  id: string | null
  value: SessionValue
}

// What apps use of the session of a request.
export type Session = Pick<
  RequestSession,
  | 'value'
  | 'login'
  | 'logout'
  | 'getUser'
  | 'refreshFingerprint'
  | 'checkConfirmedAccess'
>

// The session of a request. Handlers change `value` in place.
export class RequestSession {
  value: SessionValue
  #c: Context
  #id: string | null
  #options: SessionOptions
  // The value as loaded, to tell whether it changed.
  #loadedJson: string
  #regenerating = false
  #destroying = false
  #refreshedFingerprint: string | null = null
  #user: Promise<User | null> | null = null

  constructor(
    c: Context,
    { id, value }: LoadedSession,
    options: SessionOptions
  ) {
    this.value = value
    this.#c = c
    this.#id = id
    this.#options = options
    this.#loadedJson = JSON.stringify(value)
  }

  // Give the session a new id when it's saved, against session fixation.
  regenerate() {
    this.#regenerating = true
  }

  get source() {
    return this.#options.source
  }

  login(user: User) {
    this.value.passport = {
      user: getUserIdentifier(this.source, user),
      passwordFingerprint: getPasswordFingerprint(user.hash)
    }
    this.#regenerating = true
    this.#destroying = false
    this.#user = Promise.resolve(user)
  }

  // Clear the whole session, not just the user.
  logout() {
    this.value = {}
    this.#destroying = true
    this.#user = null
  }

  // The user of the session, once per request.
  getUser<U extends User = any>(): Promise<U | null> {
    this.#user ??= this.#findUser()
    return this.#user as Promise<U | null>
  }

  async #findUser() {
    const { source } = this
    const { passport } = this.value
    const parsed = parseUserIdentifier(passport?.user)
    if (!passport || parsed?.name !== source.name) return null
    const user: User | null = await source.findById(parsed.id)
    if (
      user &&
      passport.passwordFingerprint === getPasswordFingerprint(user.hash)
    ) {
      return user
    }
    // The user doesn't exist, or changed the password since the login.
    delete this.value.passport
    return null
  }

  // Keep the session of the request after the user changed the password,
  // while the user's other sessions end.
  refreshFingerprint(user: User) {
    if (this.value.passport?.user === getUserIdentifier(this.source, user)) {
      this.#refreshedFingerprint = getPasswordFingerprint(user.hash)
    }
  }

  confirmAccess(user: User, duration: number) {
    this.value.confirmedAccess = {
      user: getUserIdentifier(this.source, user),
      expires: Date.now() + duration
    }
  }

  // Resolve to the user, or throw 401 without a login, and 403 with
  // `confirmationRequired` without confirmed access, which makes the admin
  // confirm the access and send the request again.
  async checkConfirmedAccess<U extends User = any>() {
    const user = await this.getUser<U>()
    if (!user) throw createAuthError('Unauthorized Access')
    const { confirmedAccess } = this.value
    if (!(
      confirmedAccess?.user === getUserIdentifier(this.source, user) &&
      confirmedAccess.expires > Date.now()
    )) {
      throw createAuthError('Confirmation required', 403, {
        confirmationRequired: true
      })
    }
    return user
  }

  // Save the session and set the cookie, if anything changed.
  async commit() {
    const { adapter, secrets, cookieName, maxAge } = this.#options
    const database = adapter.getKysely()
    const c = this.#c
    let id = this.#id
    // A failed write keeps the old hash, and so the old fingerprint:
    if (this.#refreshedFingerprint && this.value.passport && !c.error) {
      this.value.passport.passwordFingerprint = this.#refreshedFingerprint
    }
    if (this.#destroying) {
      if (id) await deleteSession(database, id)
      deleteCookie(c, cookieName, { secure: isSecure(c) })
      return
    }
    if (this.#regenerating && id) {
      await deleteSession(database, id)
      id = null
    }
    const hasChanged = (
      JSON.stringify(this.value) !== this.#loadedJson ||
      this.#regenerating
    )
    if (!hasChanged || (!id && isEmpty(this.value))) return
    const expires = new Date(Date.now() + maxAge)
    const values = { value: JSON.stringify(this.value), expires_at: expires }
    if (id) {
      const { numUpdatedRows } = await database
        .updateTable('session')
        .set(values)
        .where('id', '=', id)
        .executeTakeFirst()
      // A session that a parallel request ended stays ended, and its cookie
      // as it is, as a parallel login may have replaced it:
      if (numUpdatedRows === 0n) return
    } else {
      id = randomUUID()
      await database
        .insertInto('session')
        .values({ id, ...values })
        .execute()
    }
    await setHonoSignedCookie(c, cookieName, id, secrets[0], {
      ...getCookieDefaults(c),
      expires
    })
  }
}

export function createSessions(options: CreateSessionsOptions) {
  const { adapter, secrets, cookieName } = options
  const sessionOptions = { ...options, maxAge: parseDuration(options.maxAge) }
  if (secrets.length === 0) {
    throw new Error('Unable to sign cookies without secrets.')
  }

  // The value of a cookie that one of `secrets` signed, or null, also for the
  // app's own signed cookies.
  async function readSignedCookie(c: Context, name: string) {
    for (const secret of secrets) {
      const value = await getSignedCookie(c, secret, name)
      if (value) return value
    }
    return null
  }

  // Set a cookie that `readSignedCookie()` reads, for the app's own cookies,
  // with the defaults of the session's cookie.
  function setSignedCookie(
    c: Context,
    name: string,
    value: string,
    options?: CookieOptions
  ) {
    return setHonoSignedCookie(c, name, value, secrets[0], {
      ...getCookieDefaults(c),
      ...options
    })
  }

  // The session of the request's cookie, if it hasn't expired.
  async function load(c: Context): Promise<LoadedSession> {
    const id = await readSignedCookie(c, cookieName)
    const row = id
      ? await adapter
          .getKysely()
          .selectFrom('session')
          .select('value')
          .where('id', '=', id)
          .where('expires_at', '>', new Date())
          .executeTakeFirst()
      : null
    return row
      ? { id: id as string, value: row.value }
      : { id: null, value: {} }
  }

  // The Hono middleware, which runs before the API, as `app.use()`. An action
  // can run it too, with `c.var.session` as another user's session up to the
  // end of the action. The previous session comes back after that.
  const middleware: MiddlewareHandler = async (c, next) => {
    const previous = c.var.session
    const session = new RequestSession(c, await load(c), sessionOptions)
    c.set('session', session)
    try {
      await next()
    } finally {
      c.set('session', previous)
      // Save also when the action throws, so used challenges and codes stay
      // used:
      await session.commit()
    }
  }

  return {
    middleware,
    readSignedCookie,
    setSignedCookie,
    // The id and roles of the session's user, for `createApi()`.
    async getUser({ c }: { c: Context }) {
      const user = await getSession(c).getUser()
      return user ? { id: user.id, roles: user.roles ?? [] } : null
    }
  }
}

// Delete the expired sessions of all users, who share the `session` table. The
// `jobs` of the kit run this.
export async function deleteExpiredSessions(adapter: Adapter) {
  await adapter
    .getKysely()
    .deleteFrom('session')
    .where('expires_at', '<', new Date())
    .execute()
}

// The session of the request, from the middleware of `createSessions()`.
export function getSession(c: Context) {
  const { session } = c.var
  if (!session) {
    throw new Error('Unable to use sessions without their middleware.')
  }
  return session as RequestSession
}

// The session of the running request.
export function useSession(): Session {
  return getSession(getContext())
}

function isSecure(c: Context) {
  return new URL(c.req.url).protocol === 'https:'
}

function getCookieDefaults(c: Context): CookieOptions {
  return { sameSite: 'Lax', secure: isSecure(c), httpOnly: true }
}

function deleteSession(database: Kysely<any>, id: string) {
  return database.deleteFrom('session').where('id', '=', id).execute()
}

// Sessions keep a hash of the password hash, so a password change ends the
// other sessions of the user.
export function getPasswordFingerprint(hash: string | null | undefined) {
  return hash ? createHash('sha256').update(hash).digest('base64url') : null
}
