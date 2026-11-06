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
export const defaultPasswordSchema = z
  .string({ error: 'The password is required.' })
  .min(8, 'The password needs at least 8 characters.')

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

export interface DefinePasswordWritesOptions<U extends User> {
  // Its `password` checks the new passwords.
  source: UserSource<U>
}

// The mixin of a users' model controller that stores `password` as `hash`.
export function definePasswordWrites<U extends User>({
  source
}: DefinePasswordWritesOptions<U>) {
  const {
    password = defaultPasswordSchema,
    usernameProperty = 'username'
  } = source
  const schema = z.object({
    password: password.optional(),
    hash: z
      .never({ error: `Unable to set 'hash', set 'password' instead.` })
      .optional()
  })

  // Users need confirmed access to change their own password, and their
  // username too, as password resets go to it:
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
    const { password } = result.data
    if (password === undefined) return next()
    // The handlers beneath get the body without the password, and the
    // controller writes the hash with the user that they return.
    const { password: _, ...body } = input.body
    input.body = body
    const user = (await next()) as U | undefined
    if (user) {
      user.hash = await hashPassword(password)
      // The user keeps this session, and their other sessions end.
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
