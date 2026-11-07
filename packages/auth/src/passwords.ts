import bcrypt from 'bcryptjs'
import type { Context } from 'hono'
import { z } from 'zod'
import { isPlainObject, isString } from '@ditojs/utils'
import {
  createValidationError,
  defineMixin,
  type Handler
} from '@ditojs/server'
import { bodyValidation } from '@ditojs/server/internal'
import type { Credentials } from './credentials.ts'
import { findSession, getSession } from './sessions.ts'
import type { AuthUser, UserSource } from './users.ts'

// The cost of the hashes, including the dummy one.
const hashRounds = 10
let dummyHash: Promise<string> | null = null

export function hashPassword(password: string) {
  return bcrypt.hash(password, hashRounds)
}

// Compare against a dummy hash for unknown users and users without a password,
// so that the response time doesn't reveal which usernames exist.
export async function verifyPassword(
  password: unknown,
  hash: string | null | undefined
) {
  dummyHash ??= bcrypt.hash('', hashRounds)
  const comparedHash = hash || (await dummyHash)
  return (
    isString(password) &&
    (await bcrypt.compare(password, comparedHash)) &&
    !!hash
  )
}

// Resolve to the user with the username and password, or to null. Usernames
// that aren't strings are compared like unknown ones.
export async function verifyLogin<U extends AuthUser>(
  source: UserSource<U>,
  username: unknown,
  password: unknown
) {
  const user = isString(username)
    ? await source.findByUsername(username)
    : null
  return (await verifyPassword(password, user?.hash)) ? user : null
}

// Log in a stored user. The time of the login ends password reset links.
export async function login<U extends AuthUser>(
  source: UserSource<U>,
  user: U
) {
  const session = findSession()
  if (session?.source.name !== source.name) {
    throw new Error(`Unable to log in '${source.name}' without its session.`)
  }
  if (source.hasProperty('lastLogin')) {
    await source.patch(user, { lastLogin: new Date() })
  }
  session.login(user)
}

// Set the hash on the user, which may not be stored yet. The caller flushes.
// The user keeps the session of the request, and their other sessions end. An
// admin's session may write users of another source.
export async function setPassword<U extends AuthUser>(
  source: UserSource<U>,
  user: U,
  password: string
) {
  user.hash = await hashPassword(password)
  const session = findSession()
  if (session?.source.name === source.name) {
    session.refreshFingerprint(user)
  }
}

export interface DefineUserWritesOptions<U extends AuthUser> {
  // Its `password` checks the new passwords.
  source: UserSource<U>
  // `delete :id` deletes the credentials of the user too.
  credentials: Credentials
}

// The mixin of a users' model controller that stores `password` as `hash`.
export function defineUserWrites<U extends AuthUser>({
  source,
  credentials
}: DefineUserWritesOptions<U>) {
  const { password, usernameProperty } = source
  const schema = z.object({
    password: password.optional(),
    hash: z
      .never({ error: `Unable to set 'hash', set 'password' instead.` })
      .optional()
  })

  // Changing a password needs confirmed access of the session's user, also for
  // other users and users of other sources, and so does a username, as password
  // resets go to it. The record of the model controller has the current one:
  const isSecurityChange = async (
    c: Context,
    body: Record<string, unknown>
  ) => {
    const username = body[usernameProperty]
    if (body.password === undefined && username === undefined) return false
    if (!(await getSession(c).getUser())) return false
    if (body.password !== undefined) return true
    const record = await c.var.getRecord()
    return username !== record[usernameProperty]
  }

  const handler: Handler = async input => {
    const { c, params, next } = input
    if (!isPlainObject(input.body)) return next()
    const result = await schema.safeParseAsync(input.body)
    if (!result.success) {
      throw createValidationError(result.error.issues, bodyValidation)
    }
    if (params.id && (await isSecurityChange(c, input.body))) {
      await getSession(c).checkConfirmedAccess()
    }
    const { password } = result.data
    if (password === undefined) return next()
    // The handlers beneath get the body without the password, and the
    // controller writes the hash with the user that they return.
    const { password: _, ...body } = input.body
    input.body = body
    const user = (await next()) as U | undefined
    if (user) await setPassword(source, user, password)
    return user
  }

  // Read the record first, as the handler beneath deletes it. The credentials
  // go in the request's transaction, together with the user.
  const deleteHandler: Handler = async ({ c, next }) => {
    const user = await c.var.getRecord<U>()
    const result = await next()
    await credentials.deleteUser(user)
    return result
  }

  return defineMixin({
    actions: {
      'post': handler,
      'patch :id': handler,
      'delete :id': deleteHandler
    }
  })
}
