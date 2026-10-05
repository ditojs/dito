import { defineScenario, ScenarioController } from '../../utils/fixture-app.js'
import { Family } from './models/Family.js'

export { expect } from '@playwright/test'

// Named explicitly, as the plural of `Family` isn't `Familys`.
class Families extends ScenarioController {
  override modelClass = Family
}

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Family },
  controllers: { Families }
})
