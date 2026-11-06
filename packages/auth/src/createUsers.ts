import type { EntityClass } from '@mikro-orm/core'
import {
  createEntityUserSource,
  type CreateEntityUserSourceOptions
} from '@ditojs/mikro/internal'
import { createCredentials } from './credentials.ts'
import { defineUserWrites } from './passwords.ts'
import { createSessions, type CreateSessionsOptions } from './sessions.ts'
import {
  defineUserActions,
  type DefineUserActionsOptions
} from './userActions.ts'
import type { AuthUser } from './users.ts'

export interface CreateUsersOptions<U extends object>
  extends CreateEntityUserSourceOptions<U>,
    Pick<CreateSessionsOptions, 'secrets'> {
  session: Pick<CreateSessionsOptions, 'cookieName' | 'expiresAfter'>
}

export type Users<U extends AuthUser = any> = ReturnType<typeof createUsers<U>>

// One kind of users of an app: an entity with its sessions and credentials.
// Sessions and credentials run outside of the requests' transactions, so that
// sessions save after a failed request and TOTP failures stay counted.
export function createUsers<U extends AuthUser>(
  entity: EntityClass<U>,
  { adapter, secrets, session, ...options }: CreateUsersOptions<U>
) {
  const source = createEntityUserSource<U>(entity, { ...options, adapter })
  const sessions = createSessions({ ...session, adapter, secrets, source })
  const credentials = createCredentials({ adapter, source })
  // All model controllers of the entity hash passwords and protect their users.
  adapter.wrapEntity(entity, defineUserWrites<U>({ source, credentials }))

  return {
    ...source,
    middleware: sessions.middleware,
    getUser: sessions.getUser,
    readSignedCookie: sessions.readSignedCookie,
    setSignedCookie: sessions.setSignedCookie,
    deleteSignedCookie: sessions.deleteSignedCookie,

    // The login, session and security actions, for a controller of their own.
    defineActions(options: DefineUserActionsOptions<U> = {}) {
      return defineUserActions<U>({ ...options, source, credentials, secrets })
    }
  }
}
