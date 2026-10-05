import { defineScenario, ScenarioController } from '../../utils/fixture-app.js'
import { Library } from './models/Library.js'

export { expect } from '@playwright/test'

// Named explicitly, as the plural of `Library` isn't `Librarys`.
class Libraries extends ScenarioController {
  override modelClass = Library
}

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Library },
  controllers: { Libraries }
})
