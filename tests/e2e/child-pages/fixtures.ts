import { defineScenario, ScenarioController } from '../../utils/fixture-app.js'
import { Page } from './models/Page.js'

export { expect } from '@playwright/test'

// Like lineto's pages: The child pages are loaded through their own resource,
// the relation of the page.
class Pages extends ScenarioController {
  override modelClass = Page
  override graph = true
  // Like lineto's `AdminOrderedModelController`: Stores the order of the
  // pages that the sequence button sends.
  override collection = {
    'allow': ['get', 'post', 'order'] as const,
    'post order': {
      parameters: {
        data: {
          type: 'array',
          from: 'root',
          required: true,
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer', required: true },
              order: { type: 'integer', required: true }
            }
          }
        }
      },
      handler(
        this: Pages,
        _ctx: unknown,
        { data }: { data: { id: number; order: number }[] }
      ) {
        return this.modelClass.patchDitoGraph(data)
      }
    }
  }
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
