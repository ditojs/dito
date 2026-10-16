import { UsersController } from '@ditojs/server'
import { getAppUrl } from '../../utils/app.js'
import { defineScenario } from '../../utils/fixture-app.js'
import { Credential } from './models/Credential.js'
import { Session } from './models/Session.js'
import { User } from './models/User.js'

export { expect } from '@playwright/test'

class Users extends UsersController {
  override modelClass = User
}

// Browsers only allow passkeys in secure contexts, so the admin runs on
// `localhost` instead of the loopback address of the other scenarios:
export const getLocalUrl = (url: string) =>
  url.replace('//127.0.0.1:', '//localhost:')

const passkeys = {
  name: 'Example',
  id: 'localhost',
  origins: [] as string[]
}

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Session, User, Credential },
  controllers: { Users },
  api: { users: 'users' },
  config: {
    app: {
      normalizePaths: true,
      helmet: false,
      keys: ['passkeys-secret'],
      // Passkeys and TOTP need sessions stored on the server:
      session: { modelClass: 'Session' },
      auth: {
        credentials: { modelClass: 'Credential', secret: 'credentials-secret' },
        passkeys,
        totp: { issuer: 'Example' }
      }
    }
  },
  setup: async app => {
    // The computed `password` property isn't stored in the database:
    await app.knex.schema.alterTable('User', table =>
      table.dropColumn('password')
    )
    // The origin's port is only known once the app listens:
    app.on('after:start', () => {
      passkeys.origins.push(getLocalUrl(getAppUrl(app)))
    })
  },
  beforeEach: async () => {
    await User.query().insert({ username: 'ada', password: 'secret' } as any)
  }
})
