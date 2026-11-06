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
import { getSession } from './sessions.ts'
import type { User, UserSource } from './users.ts'

// The cost of the hashes, including the dummy one.
const hashRounds = 10
let dummyHash: Promise<string> | null = null

// The schema of new passwords, unless the user source has its own.
export const defaultPassword = z
  .string({ error: 'The password is required.' })
  .min(8, 'The password needs at least 8 characters.')

export function hashPassword(password: string) {
  return bcrypt.hash(password, hashRounds)
}

// Compares against a dummy hash for unknown users and users without a password,
// so that the response time doesn't reveal which usernames exist. Passwords
// that aren't strings are wrong.
export async function verifyPassword(
  password: unknown,
  hash: string | null | undefined
) {
  dummyHash ??= bcrypt.hash('', hashRounds)
  const compared = hash || (await dummyHash)
  return (
    isString(password) &&
    (await bcrypt.compare(password, compared)) &&
    !!hash
  )
}

export interface PasswordWritesOptions<U extends User> {
  // Its `password` checks the new passwords.
  source: UserSource<U>
}

// A mixin for the `post` and `patch :id` of a model controller of the users:
// the body sets `password`, which it stores as the user's `hash`. A `hash` in
// the body responds with 400. Users who change their own password or username
// need confirmed access, as in `post password`, since password resets go to the
// username. They keep their session, and their other sessions end. The
// controller writes the hash with the user that the handler beneath returns.
export function definePasswordWrites<U extends User>({
  source
}: PasswordWritesOptions<U>) {
  const { password = defaultPassword, usernameProperty = 'username' } = source
  const schema = z.object({
    password: password.optional(),
    hash: z
      .never({ error: `Unable to set 'hash', set 'password' instead.` })
      .optional()
  })

  // Whether the logged-in user changes their own password or username.
  const isOwnSecurityChange = async (
    c: Context,
    id: string,
    body: Record<string, unknown>
  ) => {
    const username = body[usernameProperty]
    if (body.password === undefined && username === undefined) return false
    const user = await getSession(c).getUser(source)
    return (
      !!user &&
      String(user.id) === id && (
        body.password !== undefined ||
        username !== (user as Record<string, unknown>)[usernameProperty]
      )
    )
  }

  const handler: Handler = async input => {
    const { c, params, next } = input
    if (!isPlainObject(input.body)) return next()
    const result = await schema.safeParseAsync(input.body)
    if (!result.success) {
      throw createValidationError(result.error.issues, bodyValidation)
    }
    if (params.id && (await isOwnSecurityChange(c, params.id, input.body))) {
      await getSession(c).checkConfirmedAccess(source)
    }
    const { password: value, ...body } = input.body
    if (value === undefined) return next()
    // The handlers beneath get the body without the password.
    input.body = body
    const user = (await next()) as U | undefined
    if (user) {
      user.hash = await hashPassword(result.data.password!)
      getSession(c).refreshFingerprint(source, user)
    }
    return user
  }

  return defineMixin({
    actions: {
      'post': handler,
      'patch :id': handler
    }
  })
}
