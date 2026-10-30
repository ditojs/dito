import { randomUUID } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'
import { isFunction, isNumber } from '@ditojs/utils'
import type { SessionStore } from './session-store.ts'
import type { SignedCookies } from './cookies.ts'
import { authError } from './errors.ts'
import { getPasswordFingerprint } from './passwords.ts'
import { getUserIdentifier, parseUserIdentifier } from './identifiers.ts'
import type { AnyContext, SessionValue, UserSource } from './types.ts'

// Sessions as koa-session keeps them in a store: the signed cookie holds the
// id, and the store holds the value. The middleware loads the session before
// the handlers and saves it after them, when it changed. The value keeps
// Dito 6's shapes, so existing sessions stay valid: `passport` names the user
// and the fingerprint of their password, `confirmedAccess` the end of the
// confirmed access. Keys that start with `_` belong to koa-session.

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
  secure?: boolean | ((c: AnyContext) => boolean)
  domain?: string
  path?: string
}

interface SessionState {
  id: string | null
  value: SessionValue
  json: string
  hadCookie: boolean
  // Signed with an older key, so the cookie is signed again.
  stale: boolean
  regenerate: boolean
  destroy: boolean
  users: Map<string, Promise<unknown>>
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
  const states = new WeakMap<AnyContext, SessionState>()

  const getState = (c: AnyContext) => {
    const state = states.get(c)
    if (!state) {
      throw new Error(`Unable to use '${name}' without its middleware.`)
    }
    return state
  }

  const middleware: MiddlewareHandler = async (c, next) => {
    const state = await load(c)
    states.set(c, state)
    await next()
    await commit(c, state)
  }

  async function load(c: AnyContext): Promise<SessionState> {
    const cookie = cookies.get(c, name)
    const stored = cookie ? await store.get(c, cookie.value) : null
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
      json: JSON.stringify(value),
      hadCookie: !!cookie,
      stale: isValid && cookie!.index > 0,
      regenerate: false,
      destroy: false,
      users: new Map()
    }
  }

  async function commit(c: AnyContext, state: SessionState) {
    const options = {
      sameSite,
      secure: isFunction(secure)
        ? (secure as (c: AnyContext) => boolean)(c)
        : (secure ?? new URL(c.req.url).protocol === 'https:'),
      domain,
      path
    }
    if (state.destroy) {
      if (state.id) await store.destroy(c, state.id)
      if (state.hadCookie) cookies.set(c, name, null, options)
      return
    }
    const json = JSON.stringify(state.value)
    const isEmpty = Object.keys(state.value).length === 0
    if (state.regenerate && state.id) {
      await store.destroy(c, state.id)
      state.id = null
    }
    const shouldSave = json !== state.json || state.regenerate || state.stale
    if (!shouldSave || (!state.id && isEmpty)) return
    const id = state.id ?? randomUUID()
    const expire = Date.now() + maxAge
    // `_expire` and `_maxAge` as koa-session writes them.
    await store.set(c, id, { ...state.value, _expire: expire, _maxAge: maxAge })
    cookies.set(c, name, id, { ...options, expires: new Date(expire) })
  }

  // The value of the request's session, which handlers change in place.
  function session(c: AnyContext) {
    return getState(c).value
  }

  // Gives the session a new id when it's saved, against session fixation.
  function regenerate(c: AnyContext) {
    getState(c).regenerate = true
  }

  function login(c: AnyContext, source: UserSource, user: unknown) {
    const state = getState(c)
    const { hash } = source.describe(user)
    state.value.passport = {
      user: getUserIdentifier(source, user),
      // Users loaded without `hash` get their fingerprint on their next
      // request.
      ...(hash !== undefined && {
        passwordFingerprint: getPasswordFingerprint(hash)
      })
    }
    state.regenerate = true
    state.destroy = false
    state.users = new Map([[source.name, Promise.resolve(user)]])
  }

  // Clears the whole session, not just the user.
  function logout(c: AnyContext) {
    const state = getState(c)
    state.value = {}
    state.destroy = true
    state.users = new Map()
  }

  // The user of the session if it belongs to `source`, once per request.
  function getUser<U>(c: AnyContext, source: UserSource<U>): Promise<U | null> {
    const { users } = getState(c)
    let user = users.get(source.name)
    if (!user) {
      user = findUser(c, source)
      users.set(source.name, user)
    }
    return user as Promise<U | null>
  }

  async function findUser(c: AnyContext, source: UserSource) {
    const { value } = getState(c)
    const { passport } = value
    const parsed = parseUserIdentifier(passport?.user)
    if (!passport || parsed?.name !== source.name) return null
    const user = await source.findById(c, parsed.id)
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
    // The user no longer exists, or changed the password since.
    delete value.passport
    return null
  }

  // Keeps the session of the request after the user changed the password,
  // while the user's other sessions end.
  function refreshFingerprint(
    c: AnyContext,
    source: UserSource,
    user: unknown,
    hash = source.describe(user).hash
  ) {
    const { passport } = getState(c).value
    if (passport?.user === getUserIdentifier(source, user)) {
      passport.passwordFingerprint = getPasswordFingerprint(hash)
    }
  }

  function confirmAccess(
    c: AnyContext,
    source: UserSource,
    user: unknown,
    duration: number
  ) {
    getState(c).value.confirmedAccess = {
      user: getUserIdentifier(source, user),
      expires: Date.now() + duration
    }
  }

  async function hasConfirmedAccess(c: AnyContext, source: UserSource) {
    const user = await getUser(c, source)
    const { confirmedAccess } = getState(c).value
    return (
      !!user &&
      confirmedAccess?.user === getUserIdentifier(source, user) &&
      confirmedAccess.expires > Date.now()
    )
  }

  // Resolves to the user. Without a login, it throws 401. Without confirmed
  // access, it throws 403 with `confirmationRequired`, which makes the admin
  // confirm the access and send the request again.
  async function checkConfirmedAccess<U>(
    c: AnyContext,
    source: UserSource<U>
  ): Promise<U> {
    const user = await getUser(c, source)
    if (!user) throw authError('Unauthorized Access')
    if (!(await hasConfirmedAccess(c, source))) {
      throw authError('Confirmation required', 403, {
        confirmationRequired: true
      })
    }
    return user
  }

  function requireConfirmedAccess(source: UserSource): MiddlewareHandler {
    return async (c, next) => {
      await checkConfirmedAccess(c, source)
      await next()
    }
  }

  return {
    middleware,
    session,
    regenerate,
    login,
    logout,
    getUser,
    refreshFingerprint,
    confirmAccess,
    hasConfirmedAccess,
    checkConfirmedAccess,
    requireConfirmedAccess
  }
}

// The `getUser` of `createApp()`: the id and roles of the source's user.
export function sessionUser(sessions: Sessions, source: UserSource) {
  return async (c: AnyContext) => {
    const user = await sessions.getUser(c, source)
    if (!user) return null
    const { id, roles } = source.describe(user)
    return { id, roles }
  }
}
