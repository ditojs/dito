import type { EntityManager } from '@mikro-orm/core'
import { z } from 'zod'
import { hashPassword } from '@ditojs/auth'
import type { TestOrm } from '../../utils/database.js'
import { Credential, Session } from '../../utils/entities.js'
import { createUsersApi } from '../../utils/users.js'
import { User } from './models/User.js'

// The links of the password reset emails, which the tests open:
export const sentPasswordResets: string[] = []

const secrets = ['passkeys-secret']

// The users with passkeys, TOTP and password resets, with the sessions and
// credentials in the tables of `@ditojs/auth`. The admin's unit tests turn
// passkeys and TOTP off, to see what the admin offers without them.
export function createApi(orm: TestOrm, { passkeys = true, totp = true } = {}) {
  return createUsersApi({
    orm,
    entity: User,
    secrets,
    password: z.string().min(6, 'must be at least 6 characters long'),
    // The passkeys belong to the domain of the requests, `localhost`:
    passkeys: passkeys ? { rpName: 'Example' } : undefined,
    totp: totp ? { issuer: 'Example', secret: 'totp-secret' } : undefined,
    passwordReset: {
      // The tests ask for several links for one user in a row.
      resendAfter: 0,
      // The tests open the token of the links on the admin's own URL:
      confirmUrl: 'http://localhost/admin/#password-reset={token}',
      send: ({ url }) => {
        sentPasswordResets.push(url)
      }
    }
  })
}

// The app of the scenario, which the admin's unit tests start too. `seed()`
// adds the user `ada` through `em`, and forgets the sent password resets.
export const scenario = {
  entities: [Session, User, Credential],
  controllers: { Session: false, User: false, Credential: false } as const,
  users: createApi,

  seed: async (em: EntityManager) => {
    sentPasswordResets.length = 0
    em.create(User, { username: 'ada', hash: await hashPassword('secret') })
    await em.flush()
  }
}
