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

// What the model controllers of `@ditojs/mikro` set, without importing it.
interface ModelVariables {
  getRecord: () => Promise<Record<string, unknown> | null>
}

export interface DefineUserWritesOptions<U extends User> {
  // Its `password` checks the new passwords.
  source: UserSource<U>
  // Routes `delete :id`, which deletes the credentials of the user too.
  credentials?: Credentials
}

// The mixin of a users' model controller that stores `password` as `hash`.
export function defineUserWrites<U extends User>({
  source,
  credentials
}: DefineUserWritesOptions<U>) {
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

  // Changing a password needs confirmed access, also of other users, and so
  // does a username, as password resets go to it. The record of the model
  // controller has the current one, also for ids of its `load` such as `self`:
  const isSecurityChange = async (
    c: Context,
    body: Record<string, unknown>
  ) => {
    const username = body[usernameProperty]
    if (body.password === undefined && username === undefined) return false
    if (!(await getSession(c).getUser(source))) return false
    if (body.password !== undefined) return true
    const getRecord: ModelVariables['getRecord'] = c.get('getRecord')
    const record = await getRecord()
    return username !== record?.[usernameProperty]
  }

  const handler: Handler = async input => {
    const { c, params, next } = input
    if (!isPlainObject(input.body)) return next()
    const result = await schema.safeParseAsync(input.body)
    if (!result.success) {
      throw createValidationError(result.error.issues, bodyValidation)
    }
    if (params.id && (await isSecurityChange(c, input.body))) {
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

  // Read the record first, as the handler beneath deletes it. Its id also
  // resolves aliases of `load` such as `self`. The credentials go in the
  // request's transaction, together with the user.
  const deleteHandler: Handler = async ({ c, next }) => {
    const getRecord: () => Promise<U | null> = c.get('getRecord')
    const user = await getRecord()
    const result = await next()
    if (user) {
      await credentials!.deleteUser(source, user, {
        trx: credentials!.getKysely(c)
      })
    }
    return result
  }

  return defineMixin({
    actions: {
      'post': handler,
      'patch :id': handler,
      ...(credentials && { 'delete :id': deleteHandler })
    }
  })
}
