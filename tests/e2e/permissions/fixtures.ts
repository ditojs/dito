import { db, defineScenario } from '../../utils/fixture-app.js'
import { Secret } from './models/Secret.js'
import { Vault } from './models/Vault.js'

export { expect } from '@playwright/test'
export { db } from '../../utils/fixture-app.js'

export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [Vault, Secret],
  controllers: {
    // Denies access to the logged in user, like controllers that require
    // roles the user doesn't have.
    Secret: { authorize: () => false }
  },
  beforeEach: async () => {
    await db.insert(Vault, { name: 'Vault' })
    await db.insert(Secret, { name: 'Hidden' })
  }
})
