import type { ModelControllerActions } from '@ditojs/server'
import { defineScenario, ScenarioController } from '../../utils/fixture-app.js'
import { Page } from './models/Page.js'

export { expect } from '@playwright/test'

// The child pages are loaded through their own resource, the relation of the
// page.
class Pages extends ScenarioController {
  override modelClass = Page
  override graph = true
  // Stores the order of the pages that the order button sends.
  override collection: ModelControllerActions<this> = {
    'allow': ['get', 'post'],
    'post order': {
      parameters: {
        data: {
          type: 'array',
          items: { type: 'object' },
          from: 'root',
          required: true
        }
      },
      handler(_ctx: unknown, { data }: { data: Pick<Page, 'id' | 'order'>[] }) {
        return Page.query().patchDitoGraph(data)
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
