import { defineScenario, ScenarioController } from '../../utils/fixture-app.js'
import { Page } from './models/Page.js'

export { expect } from '@playwright/test'

// Like lineto's pages: The child pages are loaded through their own resource,
// the relation of the page.
class Pages extends ScenarioController {
  override modelClass = Page
  override graph = true
  override relations = {
    childPages: {
      relation: { allow: ['get'] as const },
      member: { allow: ['get'] as const }
    }
  }
}

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Page },
  controllers: { Pages }
})
