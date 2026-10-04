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
  // Expose the items relation as a nested REST resource on Widgets so
  // GET/PATCH /api/widgets/:id/items/:id work — the route nesting is what
  // lets SourceMixin's `from.path.startsWith(to.path)` watcher trigger when
  // cancelling back from a non-inlined item sub-form. Disable `graph` on
  // the relation: it inherits from Widgets, but upsertGraph through
  // `$relatedQuery` collides with the parent's findById filter ("upsertGraph
  // query should contain no other query builder calls"). A plain member
  // patch is what we want anyway.
  override relations = {
    items: {
      graph: false,
      relation: { allow: ['get', 'post'] as const },
      member: { allow: ['get', 'patch', 'delete'] as const }
    }
  }
}

export const test = defineScenario({
  dirname: import.meta.dirname,
  models: { Widget, Item },
  controllers: { Widgets }
})
