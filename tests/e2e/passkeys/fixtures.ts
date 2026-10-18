import { PasskeyService, TotpService, UsersController } from '@ditojs/server'
import { defineScenario } from '../../utils/fixture-app.js'
import { Credential } from './models/Credential.js'
import { Session } from './models/Session.js'
import { User } from './models/User.js'

export { expect } from '@playwright/test'

// The links of the password reset emails, which the tests open:
export const sentPasswordResets: string[] = []

class Users extends UsersController {
  override modelClass = User

  override async sendPasswordReset(ctx: unknown, user: User, url: string) {
    sentPasswordResets.push(url)
  }
}

// Browsers only allow passkeys in secure contexts, so the admin runs on
// `localhost` instead of the loopback address of the other scenarios:
export const getLocalUrl = (url: string) =>
  url.replace('//127.0.0.1:', '//localhost:')

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Session, User, Credential },
  controllers: { Users },
  services: { passkeys: PasskeyService, totp: TotpService },
  api: { users: 'users' },
  config: {
    app: {
      name: 'Example',
      normalizePaths: true,
      helmet: false,
      keys: ['passkeys-secret'],
      // Passkeys and TOTP need sessions stored on the server:
      session: { modelClass: 'Session' },
      auth: {
        credentials: { modelClass: 'Credential' },
        // The tests open the token of the links on the admin's own URL:
        passwordReset: {
          confirmUrl: 'http://localhost/admin/#password-reset={token}'
        }
      }
    },
    services: {
      // The passkeys belong to the domain of the requests, `localhost`:
      passkeys: true,
      totp: { secret: 'totp-secret' }
    }
  },
  setup: async app => {
    // The computed `password` property isn't stored in the database:
    await app.knex.schema.alterTable('User', table =>
      table.dropColumn('password')
    )
  },
  beforeEach: async () => {
    sentPasswordResets.length = 0
    await User.query().insert({ username: 'ada', password: 'secret' } as any)
  }
})
