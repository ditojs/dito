import { hashPassword } from '@ditojs/auth'
import { db, defineScenario } from '../../utils/fixture-app.js'
import { Credential, Session } from '../../utils/entities.js'
import { createUsersApi } from '../../utils/users.js'
import { User } from './models/User.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

// Log in through the users' routes instead of the stubbed session. Users only
// read and patch themselves, at `users/self`.
export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Credential, Session, User],
  controllers: { Session: false, User: false },
  users: orm =>
    createUsersApi({ orm, entity: User, secrets: ['account-secret'] }),
  api: { users: { path: 'users' } },
  beforeEach: async () => {
    await db.insert(User, {
      username: 'ada',
      email: 'ada@example.com',
      hash: await hashPassword('secret')
    })
  }
})
