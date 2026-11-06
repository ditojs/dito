import type { EntityClass } from '@mikro-orm/core'
import { wrap } from '@mikro-orm/core'
import type { z } from 'zod'
import { createUsers, type DefineActionsOptions } from '@ditojs/auth'
import { assignRecord, createMikroAdapter } from '@ditojs/mikro'
import { HttpError, type Handler } from '@ditojs/server'
import type { TestApi } from './app.js'
import type { TestOrm } from './database.js'

// The users of a scenario that logs in: `createUsers()` of `@ditojs/auth` at
// `users`, on the rows of a user entity, with the tables of `Session` and
// `Credential` in `./entities.ts`.

export interface TestUser {
  id: number
  username: string
  hash?: string | null
  roles?: string[] | null
  lastLogin?: Date | null
}

export interface UsersApiOptions<
  U extends TestUser
> extends DefineActionsOptions<U> {
  orm: TestOrm
  entity: EntityClass<U>
  secrets: string[]
  // The schema of new passwords, on the user source.
  password?: z.ZodType<string>
}

export function createUsersApi<U extends TestUser>({
  orm,
  entity,
  secrets,
  password,
  ...options
}: UsersApiOptions<U>): TestApi {
  const adapter = createMikroAdapter(orm)
  const users = createUsers(entity, {
    adapter,
    secrets,
    session: { cookieName: 'dito.sess', maxAge: 24 * 60 * 60 * 1000 },
    // Leaves out the hidden `hash`.
    serialize: ({ user }) => wrap(user).toObject(),
    password
  })
  // Users change their own values, but not the password or its hash.
  const patchSelf: Handler = async ({ body, em, session }) => {
    const user = await session.getUser<U>()
    if (!user) throw new HttpError(401)
    const { password, hash, ...values } = body ?? {}
    await assignRecord(em, user, values)
    await em.flush()
    return users.serialize(user)
  }
  return {
    controllers: [
      {
        path: 'users',
        mixins: [users.defineActions(options)],
        actions: {
          'patch self': { authorize: true, handler: patchSelf }
        }
      }
    ],
    middleware: [users.middleware],
    getUser: users.getUser,
    adapter
  }
}
