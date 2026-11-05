import type { EntityClass } from '@mikro-orm/core'
import { wrap } from '@mikro-orm/core'
import {
  createSessions,
  defineUserActions,
  getSession,
  getSessionUser,
  type DefineUserActionsOptions
} from '@ditojs/auth'
import {
  assignRecord,
  createEntityUserSource,
  createMikroAdapter
} from '@ditojs/mikro'
import { HttpError, type Handler } from '@ditojs/server'
import type { TestApi } from './app.js'
import type { TestOrm } from './database.js'

// The users of a scenario that logs in: `defineUserActions()` of `@ditojs/auth`
// at `users`, on the rows of a user entity, with sessions in the `session`
// table of `Session` in `./entities.ts`.

export interface TestUser {
  id: number
  username: string
  hash?: string | null
  roles?: string[] | null
  lastLogin?: Date | null
}

export interface UsersApiOptions<U extends TestUser> extends Omit<
  DefineUserActionsOptions<U>,
  'path' | 'source'
> {
  orm: TestOrm
  entity: EntityClass<U>
  secrets: string[]
}

export function createUsersApi<U extends TestUser>({
  orm,
  entity,
  secrets,
  ...options
}: UsersApiOptions<U>): TestApi {
  // Leaves out the hidden `hash`.
  const source = createEntityUserSource(entity, {
    em: orm.em,
    serialize: ({ user }) => wrap(user).toObject()
  })
  const sessions = createSessions({
    adapter: createMikroAdapter(orm),
    secrets,
    cookieName: 'dito.sess',
    maxAge: 24 * 60 * 60 * 1000
  })
  const { controller, features } = defineUserActions({
    path: 'users',
    source,
    ...options
  })
  // Users change their own values, but not the password or its hash.
  const patchSelf: Handler = async ({ body, em, c }) => {
    const user = await getSession(c).getUser(source)
    if (!user) throw new HttpError(401)
    const { password, hash, ...values } = body ?? {}
    await assignRecord(em, user, values)
    await em.flush()
    return source.serialize(c, user)
  }
  return {
    controllers: [
      {
        path: 'users',
        mixins: [controller],
        actions: {
          'patch self': { authorize: true, handler: patchSelf }
        }
      }
    ],
    middleware: [sessions.middleware],
    getUser: ({ c }) => getSessionUser(c, source),
    authentication: features
  }
}
