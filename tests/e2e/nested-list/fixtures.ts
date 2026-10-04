import { defineScenario, ScenarioController } from '../../utils/fixture-app.js'
import { Item } from './models/Item.js'
import { Widget } from './models/Widget.js'

export { expect } from '@playwright/test'

class Widgets extends ScenarioController {
  override modelClass = Widget
  // `^withItems` forces the model's `withItems` scope on every query so
  // GET /api/widgets/:id re-hydrates the items relation. `graph = true`
  // switches PATCH/POST to the graph variants so `items: [...]` in the
  // body inserts/updates Item rows (combined with `owner: true` on the
  // relation).
  override scope = ['^withItems']
  override graph = true
}

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Widget, Item },
  controllers: { Widgets }
})
