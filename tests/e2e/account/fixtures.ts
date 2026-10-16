import { UsersController } from '@ditojs/server'
import { defineScenario } from '../../utils/fixture-app.js'
import { User } from './models/User.js'

export { expect } from '@playwright/test'

// Users may only read and patch themselves, see `authorize` of
// `UsersController`:
class Users extends UsersController {
  override modelClass = User
  override member: any = {
    allow: ['get', 'patch']
  }
}

// Log in through the users' controller instead of the stubbed session:
export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { User },
  controllers: { Users },
  api: { users: 'users' },
  config: {
    app: {
      normalizePaths: true,
      helmet: false,
      keys: ['account-secret'],
      session: true
    }
  },
  // The computed `password` property isn't stored in the database:
  setup: app =>
    app.knex.schema.alterTable('User', table => table.dropColumn('password')),
  beforeEach: async () => {
    await User.query().insert({
      username: 'ada',
      email: 'ada@example.com',
      password: 'secret'
    } as any)
  }
})
