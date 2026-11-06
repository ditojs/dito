import type { EntityClass, EntityManager } from '@mikro-orm/core'
import {
  createEntityUserSource,
  createMikroAdapter,
  type EntityUserSourceOptions
} from '@ditojs/mikro'
import { createCredentials } from './credentials.ts'
import type { CreatePasswordResetOptions } from './passwordReset.ts'
import { defineUserWrites } from './passwords.ts'
import { createSessions, type CreateSessionsOptions } from './sessions.ts'
import {
  defineUserActions,
  type DefineUserActionsOptions
} from './userActions.ts'
import type { User } from './users.ts'

export interface CreateUsersOptions<U extends object>
  extends Omit<EntityUserSourceOptions<U>, 'orm'> {
  // The ORM with its `session` and `credential` tables.
  orm: { em: EntityManager }
  // The secrets that sign the cookies and the password reset links. The first
  // one signs, and all of them verify, so secrets can rotate.
  secrets: string[]
  session: Pick<CreateSessionsOptions, 'cookieName' | 'maxAge'>
}

export interface DefineActionsOptions<U extends User> extends Omit<
  DefineUserActionsOptions<U>,
  'source' | 'credentials' | 'passwordReset'
> {
  passwordReset?: Omit<CreatePasswordResetOptions, 'secrets'>
}

export type Users<U extends User = any> = ReturnType<typeof createUsers<U>>

// One kind of users of an app: an entity with its sessions and credentials.
// Sessions and credentials run outside of the requests' transactions, so that
// sessions save after a failed request and TOTP failures stay counted.
export function createUsers<U extends User>(
  entity: EntityClass<U>,
  { orm, secrets, session, ...options }: CreateUsersOptions<U>
) {
  const source = createEntityUserSource<U>(entity, { ...options, orm })
  const adapter = createMikroAdapter(orm)
  const sessions = createSessions({
    ...session,
    adapter,
    secrets,
    users: source
  })
  const credentials = createCredentials({ adapter })

  return {
    ...source,
    middleware: sessions.middleware,
    getUser: sessions.getUser,
    readSignedCookie: sessions.readSignedCookie,
    deleteExpiredSessions: sessions.deleteExpired,

    // The login, session and security actions, for a controller of their own.
    defineActions({ passwordReset, ...rest }: DefineActionsOptions<U> = {}) {
      return defineUserActions<U>({
        ...rest,
        source,
        credentials,
        passwordReset: passwordReset && { ...passwordReset, secrets }
      })
    },

    // The mixin of the users' model controller.
    defineWrites() {
      return defineUserWrites<U>({ source, credentials })
    }
  }
}
