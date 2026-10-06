import { defineScenario, ScenarioController } from '../../utils/fixture-app.js'
import { Secret } from './models/Secret.js'
import { Vault } from './models/Vault.js'

export { expect } from '@playwright/test'

// Denies access to the logged in user, like controllers that require roles
// the user doesn't have.
class Secrets extends ScenarioController {
  override modelClass = Secret
  override authorize = () => false
}

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Vault, Secret },
  controllers: { Secrets },
  beforeEach: async () => {
    await Vault.query().insert({ id: 1, name: 'Vault' })
    await Secret.query().insert({ id: 1, name: 'Hidden' })
  }
})
