import { randomUUID } from 'node:crypto'
import type { DitoContext, Middleware } from '@ditojs/server-next'
import { isFunction, isNumber } from '@ditojs/utils'
import type { SessionStore } from './session-store.ts'
import type { SignedCookies } from './cookies.ts'
import { authError } from './errors.ts'
import { getPasswordFingerprint } from './passwords.ts'
import { getUserIdentifier, parseUserIdentifier } from './identifiers.ts'
import type { SessionValue, UserSource } from './types.ts'

// Sessions as koa-session keeps them in a store: the signed cookie holds the
// id, and the store holds the value. The middleware loads the session into
// `ctx.locals.session` before the action and saves it after it, when it
// changed. The value keeps Dito 6's shapes, so existing sessions stay valid:
// `passport` names the user and the fingerprint of their password,
// `confirmedAccess` the end of the confirmed access. Keys that start with `_`
// belong to koa-session.

declare module '@ditojs/server-next' {
  interface DitoLocals {
    session: Session
  }
}

export interface SessionsOptions {
  store: SessionStore
  cookies: SignedCookies
  // The cookie name, such as `admin.sess`.
  name: string
  // In milliseconds.
  maxAge: number
  sameSite?: 'lax' | 'strict' | 'none'
  // Whether the cookie is `Secure`. By default, when the request URL is https.
  // Apps behind a proxy that they trust can read `X-Forwarded-Proto` here.
  secure?: boolean | ((ctx: DitoContext) => boolean)
  domain?: string
  path?: string
}

interface Loaded {
  id: string | null
  value: SessionValue
  hadCookie: boolean
  // Signed with an older key, so the cookie is signed again.
  stale: boolean
}

interface State extends Loaded {
  ctx: DitoContext
  // The value as loaded, to tell whether it changed.
  json: string
  regenerate: boolean
  destroy: boolean
  users: Map<string, Promise<unknown>>
}

const states = new WeakMap<Session, State>()

// The session of a request. Handlers change `value` in place.
export class Session {
  value: SessionValue

  constructor(ctx: DitoContext, loaded: Loaded) {
    this.value = loaded.value
    states.set(this, {
      ...loaded,
      ctx,
      json: JSON.stringify(loaded.value),
      regenerate: false,
      destroy: false,
      users: new Map()
    })
  }

  // Gives the session a new id when it's saved, against session fixation.
  regenerate() {
    states.get(this)!.regenerate = true
  }

  login(source: UserSource, user: unknown) {
    const { hash } = source.describe(user)
    this.value.passport = {
      user: getUserIdentifier(source, user),
      // Users loaded without `hash` get their fingerprint on their next
      // request.
      ...(hash !== undefined && {
        passwordFingerprint: getPasswordFingerprint(hash)
      })
    }
    const state = states.get(this)!
    state.regenerate = true
    state.destroy = false
    state.users = new Map([[source.name, Promise.resolve(user)]])
  }

  // Clears the whole session, not just the user.
  logout() {
    const state = states.get(this)!
    this.value = {}
    state.destroy = true
    state.users = new Map()
  }

  // The user of the session if it belongs to `source`, once per request.
  getUser<U>(source: UserSource<U>): Promise<U | null> {
    const { users } = states.get(this)!
    let user = users.get(source.name)
    if (!user) {
      user = this.#findUser(source)
      users.set(source.name, user)
    }
    return user as Promise<U | null>
  }

  async #findUser(source: UserSource) {
    const { passport } = this.value
    const parsed = parseUserIdentifier(passport?.user)
    if (!passport || parsed?.name !== source.name) return null
    const user = await source.findById(states.get(this)!.ctx, parsed.id)
    const hash = user ? source.describe(user).hash : undefined
    const { passwordFingerprint } = passport
    if (
      user && (
        passwordFingerprint === undefined ||
        passwordFingerprint === getPasswordFingerprint(hash)
      )
    ) {
      // Sessions from before fingerprints get theirs now.
      if (passwordFingerprint === undefined && hash !== undefined) {
        passport.passwordFingerprint = getPasswordFingerprint(hash)
      }
      return user
    }
    // The user doesn't exist, or changed the password since the login.
    delete this.value.passport
    return null
  }

  // Keeps the session of the request after the user changed the password,
  // while the user's other sessions end.
  refreshFingerprint(
    source: UserSource,
    user: unknown,
    hash = source.describe(user).hash
  ) {
    const { passport } = this.value
    if (passport?.user === getUserIdentifier(source, user)) {
      passport.passwordFingerprint = getPasswordFingerprint(hash)
    }
  }

  confirmAccess(source: UserSource, user: unknown, duration: number) {
    this.value.confirmedAccess = {
      user: getUserIdentifier(source, user),
      expires: Date.now() + duration
    }
  }

  async hasConfirmedAccess(source: UserSource) {
    const user = await this.getUser(source)
    const { confirmedAccess } = this.value
    return (
      !!user &&
      confirmedAccess?.user === getUserIdentifier(source, user) &&
      confirmedAccess.expires > Date.now()
    )
  }

  // Resolves to the user. Without a login, it throws 401. Without confirmed
  // access, it throws 403 with `confirmationRequired`, which makes the admin
  // confirm the access and send the request again.
  async checkConfirmedAccess<U>(source: UserSource<U>): Promise<U> {
    const user = await this.getUser(source)
    if (!user) throw authError('Unauthorized Access')
    if (!(await this.hasConfirmedAccess(source))) {
      throw authError('Confirmation required', 403, {
        confirmationRequired: true
      })
    }
    return user
  }
}

export type Sessions = ReturnType<typeof createSessions>

export function createSessions({
  store,
  cookies,
  name,
  maxAge,
  sameSite = 'lax',
  secure,
  domain,
  path
}: SessionsOptions) {
  // The valid session of the request's cookie.
  async function load(headers: Headers): Promise<Loaded> {
    const cookie = cookies.get(headers, name)
    const stored = cookie ? await store.get(cookie.value) : null
    const isValid = (
      !!stored &&
      !(isNumber(stored._expire) && stored._expire < Date.now())
    )
    const value: SessionValue = {}
    if (isValid) {
      for (const [key, entry] of Object.entries(stored)) {
        if (!key.startsWith('_')) value[key] = entry
      }
    }
    return {
      id: isValid ? cookie!.value : null,
      value,
      hadCookie: !!cookie,
      stale: isValid && cookie!.index > 0
    }
  }

  async function save(ctx: DitoContext, session: Session) {
    const { headers } = ctx.res
    const state = states.get(session)!
    const options = {
      sameSite,
      secure: isFunction(secure)
        ? (secure as (ctx: DitoContext) => boolean)(ctx)
        : (secure ?? ctx.url.protocol === 'https:'),
      domain,
      path
    }
    if (state.destroy) {
      if (state.id) await store.destroy(state.id)
      if (state.hadCookie) cookies.set(headers, name, null, options)
      return
    }
    const { value } = session
    const json = JSON.stringify(value)
    const isEmpty = Object.keys(value).length === 0
    let { id } = state
    if (state.regenerate && id) {
      await store.destroy(id)
      id = null
    }
    const shouldSave = (
      json !== state.json ||
      state.regenerate ||
      state.stale
    )
    if (!shouldSave || (!id && isEmpty)) return
    id ??= randomUUID()
    const expire = Date.now() + maxAge
    // `_expire` and `_maxAge` as koa-session writes them.
    await store.set(id, { ...value, _expire: expire, _maxAge: maxAge })
    cookies.set(headers, name, id, { ...options, expires: new Date(expire) })
  }

  // The middleware for the `around` of `createApp()`. It saves the session
  // also when the action throws, so used challenges and codes stay used.
  const middleware: Middleware = async (ctx, next) => {
    const session = new Session(ctx, await load(ctx.req.headers))
    ctx.locals.session = session
    try {
      return await next()
    } finally {
      await save(ctx, session)
    }
  }

  // The value of a request's session, or null, for hosts outside of Dito.
  // It doesn't save the session.
  async function read(request: Request): Promise<SessionValue | null> {
    const { id, value } = await load(request.headers)
    return id ? value : null
  }

  return { name, middleware, read }
}

// The session of the request, from the middleware of `createSessions()`.
export function getSession(ctx: DitoContext) {
  const { session } = ctx.locals
  if (!session) {
    throw new Error('Unable to use sessions without their middleware.')
  }
  return session
}

// Middleware that throws unless the user of `source` confirmed the access.
export function requireConfirmedAccess(source: UserSource): Middleware {
  return async (ctx, next) => {
    await getSession(ctx).checkConfirmedAccess(source)
    return next()
  }
}

// The `getUser` of `createApp()`: the id and roles of the source's user, as
// `getUser: sessionUser(admins)`.
export function sessionUser(source: UserSource) {
  return async (ctx: DitoContext) => {
    const user = await getSession(ctx).getUser(source)
    if (!user) return null
    const { id, roles } = source.describe(user)
    return { id, roles }
  }
}
