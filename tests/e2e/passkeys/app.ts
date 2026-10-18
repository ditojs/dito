import type { Application } from '@ditojs/server'
import { PasskeyService, TotpService, UsersController } from '@ditojs/server'
import type { Knex } from 'knex'
import { Credential } from './models/Credential.js'
import { Session } from './models/Session.js'
import { User } from './models/User.js'

// The links of the password reset emails, which the tests open:
export const sentPasswordResets: string[] = []

class Users extends UsersController {
  override modelClass = User

  override async sendPasswordReset(ctx: unknown, user: User, url: string) {
    sentPasswordResets.push(url)
  }
}

// The app of the scenario, which the admin's unit tests start too:
export const scenario = {
  models: { Session, User, Credential },
  controllers: { Users },
  services: { passkeys: PasskeyService, totp: TotpService },
  config: {
    app: {
      name: 'Example',
      normalizePaths: true,
      helmet: false,
      keys: ['passkeys-secret'],
      // Passkeys and TOTP need sessions stored on the server:
      session: { modelClass: 'Session' },
      authentication: {
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

  setup: async (app: Application & { knex: Knex }) => {
    // The computed `password` property isn't stored in the database:
    await app.knex.schema.alterTable('User', table =>
      table.dropColumn('password')
    )
  },

  beforeEach: async () => {
    sentPasswordResets.length = 0
    await User.query().insert({ username: 'ada', password: 'secret' } as any)
  }
}
