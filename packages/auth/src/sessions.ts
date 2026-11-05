import { randomUUID } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import type { Kysely } from 'kysely'
import { isEmpty } from '@ditojs/utils'
import {
  authError,
  getPasswordFingerprint,
  getUserIdentifier,
  parseUserIdentifier
} from './authentication.ts'
import type { User, UserSource } from './types.ts'

// Sessions in the `session` table: the signed cookie holds the id, and the row
// holds `value` as JSON and `expires_at`. The middleware loads the session into
// `c.var.session` before the action, and saves it after the action if it
// changed. In the value, `passport` names the user and the fingerprint of their
// password, and `confirmedAccess` the end of the confirmed access.

declare module 'hono' {
  interface ContextVariableMap {
    session: Session
  }
}

export interface CreateSessionsOptions {
  // The adapter of the API, such as `createMikroAdapter(orm)`, for the
  // `session` table. Sessions load before and save after the actions, so they
  // use its Kysely outside of the request's transaction.
  adapter: { getKysely(): Kysely<any> }
  // The secrets that sign the cookie. The first one signs, and all of them
  // verify, so secrets can rotate.
  secrets: string[]
  // The cookie name, such as `admin.sess`.
  cookieName: string
  // In milliseconds.
  maxAge: number
}

// The value of a session. The app may add its own keys.
interface SessionValue {
  [key: string]: any
  passport?: { user: string; passwordFingerprint: string | null }
  confirmedAccess?: { user: string; expires: number }
  pendingLogin?: { user: string; expires: number }
}

interface Loaded {
  id: string | null
  value: SessionValue
}

// The session of a request. Handlers change `value` in place.
export class Session {
  value: SessionValue
  #c: Context
  #loaded: Loaded
  #options: CreateSessionsOptions
  // The value as loaded, to tell whether it changed.
  #json: string
  #regenerate = false
  #destroy = false
  #fingerprint: string | null = null
  #users = new Map<string, Promise<User | null>>()

  constructor(c: Context, loaded: Loaded, options: CreateSessionsOptions) {
    this.value = loaded.value
    this.#c = c
    this.#loaded = loaded
    this.#options = options
    this.#json = JSON.stringify(loaded.value)
  }

  // Gives the session a new id when it's saved, against session fixation.
  regenerate() {
    this.#regenerate = true
  }

  login<U extends User>(source: UserSource<U>, user: U) {
    this.value.passport = {
      user: getUserIdentifier(source, user),
      passwordFingerprint: getPasswordFingerprint(user.hash)
    }
    this.#regenerate = true
    this.#destroy = false
    this.#users = new Map([[source.name, Promise.resolve(user)]])
  }

  // Clears the whole session, not just the user.
  logout() {
    this.value = {}
    this.#destroy = true
    this.#users = new Map()
  }

  // The user of the session if it belongs to `source`, once per request.
  getUser<U extends User>(source: UserSource<U>): Promise<U | null> {
    let user = this.#users.get(source.name)
    if (!user) {
      user = this.#findUser(source)
      this.#users.set(source.name, user)
    }
    return user as Promise<U | null>
  }

  async #findUser(source: UserSource<any>) {
    const { passport } = this.value
    const parsed = parseUserIdentifier(passport?.user)
    if (!passport || parsed?.name !== source.name) return null
    const user: User | null | undefined = await source.findById(
      this.#c,
      parsed.id
    )
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

  // Keeps the session of the request after the user changed the password,
  // while the user's other sessions end. It applies when the session is saved
  // after a request without an error, as a failed write keeps the old hash.
  refreshFingerprint(source: UserSource<any>, user: User) {
    if (this.value.passport?.user === getUserIdentifier(source, user)) {
      this.#fingerprint = getPasswordFingerprint(user.hash)
    }
  }

  confirmAccess(source: UserSource<any>, user: User, duration: number) {
    this.value.confirmedAccess = {
      user: getUserIdentifier(source, user),
      expires: Date.now() + duration
    }
  }

  // Resolves to the user. Without a login, it throws 401. Without confirmed
  // access, it throws 403 with `confirmationRequired`, which makes the admin
  // confirm the access and send the request again.
  async checkConfirmedAccess<U extends User>(source: UserSource<U>) {
    const user = await this.getUser(source)
    if (!user) throw authError('Unauthorized Access')
    const { confirmedAccess } = this.value
    if (!(
      confirmedAccess?.user === getUserIdentifier(source, user) &&
      confirmedAccess.expires > Date.now()
    )) {
      throw authError('Confirmation required', 403, {
        confirmationRequired: true
      })
    }
    return user
  }

  // Saves the session and sets the cookie, if anything changed. A session
  // that a parallel request ended stays ended, and its cookie stays as it is,
  // as a parallel login may have replaced it.
  async commit() {
    const { adapter, secrets, cookieName, maxAge } = this.#options
    const db = adapter.getKysely()
    const c = this.#c
    const secure = new URL(c.req.url).protocol === 'https:'
    let { id } = this.#loaded
    if (this.#fingerprint && this.value.passport && !c.error) {
      this.value.passport.passwordFingerprint = this.#fingerprint
    }
    if (this.#destroy) {
      if (id) await destroy(db, id)
      deleteCookie(c, cookieName, { secure })
      return
    }
    if (this.#regenerate && id) {
      await destroy(db, id)
      id = null
    }
    const isChanged = (
      JSON.stringify(this.value) !== this.#json ||
      this.#regenerate
    )
    if (!isChanged || (!id && isEmpty(this.value))) return
    const expires = new Date(Date.now() + maxAge)
    const values = { value: JSON.stringify(this.value), expires_at: expires }
    if (id) {
      const { numUpdatedRows } = await db
        .updateTable('session')
        .set(values)
        .where('id', '=', id)
        .executeTakeFirst()
      if (numUpdatedRows === 0n) return
    } else {
      id = randomUUID()
      await db
        .insertInto('session')
        .values({ id, ...values })
        .execute()
    }
    await setSignedCookie(c, cookieName, id, secrets[0], {
      expires,
      sameSite: 'Lax',
      secure,
      httpOnly: true
    })
  }
}

export type Sessions = ReturnType<typeof createSessions>

export function createSessions(options: CreateSessionsOptions) {
  const { adapter, secrets, cookieName } = options
  if (secrets.length === 0) {
    throw new Error('Unable to sign cookies without secrets.')
  }

  // The session of the request's cookie, if it hasn't expired.
  async function load(c: Context): Promise<Loaded> {
    const id = await readSignedCookie(c, secrets, cookieName)
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

  // The Hono middleware, which runs before the API, as `app.use()`. It saves
  // the session even when the action throws, so used challenges and codes
  // stay used.
  const middleware: MiddlewareHandler = async (c, next) => {
    const session = new Session(c, await load(c), options)
    c.set('session', session)
    try {
      await next()
    } finally {
      await session.commit()
    }
  }

  return { cookieName, middleware }
}

// The value of a cookie that one of `secrets` signed, or null. `secrets` are
// the ones of `createSessions()`, for the app's own signed cookies.
export async function readSignedCookie(
  c: Context,
  secrets: string[],
  name: string
) {
  for (const secret of secrets) {
    const value = await getSignedCookie(c, secret, name)
    if (value) return value
  }
  return null
}

// Deletes the expired sessions. The app runs it on a timer.
export async function deleteExpiredSessions(db: Kysely<any>) {
  await db
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
  return session
}

// The id and roles of the source's user, for the `getUser` of `createApi()`,
// as `getUser: c => getSessionUser(c, admins)`.
export async function getSessionUser(c: Context, source: UserSource<any>) {
  const user = await getSession(c).getUser(source)
  return user ? { id: user.id, roles: user.roles ?? [] } : null
}

function destroy(db: Kysely<any>, id: string) {
  return db.deleteFrom('session').where('id', '=', id).execute()
}
