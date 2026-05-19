import path from 'path'
import { AdminController, ModelController } from '@ditojs/server'
import {
  createFixtureAppFixture,
  createModelHelpers
} from '../../utils/fixture-app.js'
import { Item } from './models/Item.js'
import { Widget } from './models/Widget.js'

export { expect } from '@playwright/test'
export { createModelHelpers, Item, Widget }

class Widgets extends ModelController {
  override modelClass = Widget
  // `^withItems` forces the model's `withItems` scope on every query so
  // GET /api/widgets/:id re-hydrates the items relation. `graph = true`
  // switches PATCH/POST to the graph variants so `items: [...]` in the
  // body actually inserts/updates Item rows (combined with `owner: true`
  // on the relation).
  override scope = ['^withItems']
  override graph = true
  collection = {
    allow: ['get', 'post'] as const
  }
  member = {
    allow: ['get', 'patch', 'delete'] as const
  }
  // Expose the items relation as a nested REST resource on Widgets so
  // GET/PATCH /api/widgets/:id/items/:id work — the route nesting is
  // what lets SourceMixin's `from.path.startsWith(to.path)` watcher
  // trigger when cancelling back from a non-inlined item sub-form.
  // Disable `graph` on the relation: it inherits from Widgets, but
  // upsertGraph through `$relatedQuery` collides with the parent's
  // findById filter ("upsertGraph query should contain no other query
  // builder calls"). A plain member patch is what we want anyway.
  override relations = {
    items: {
      graph: false,
      relation: { allow: ['get', 'post'] as const },
      member: { allow: ['get', 'patch', 'delete'] as const }
    }
  }
}

class Items extends ModelController {
  override modelClass = Item
  collection = {
    allow: ['get', 'post'] as const
  }
  member = {
    allow: ['get', 'patch', 'delete'] as const
  }
}

export const test = createFixtureAppFixture({
  appRoot: path.resolve(import.meta.dirname, 'app'),
  models: { Widget, Item },
  controllers: {
    admin: AdminController,
    api: { Widgets, Items }
  },
  warmupPath: '/admin/widgets'
}).extend<{ resetState: void }>({
  // Auto-runs before every test. Tests share one PGlite DB per worker
  // (Playwright runs in-file tests sequentially), so reset before each.
  // Order: clear Item first (FK to Widget), then Widget.
  //
  // The `url: _url` parameter looks unused but isn't — Playwright
  // fixtures only initialize on request, and naming `url` here triggers
  // the worker fixture chain that boots the embedded app and binds
  // models to in-process knex. The `_` prefix tells the linter it's
  // intentional.
  resetState: [
    async ({ url: _url }, use) => {
      await Item.query().delete()
      await Widget.query().delete()
      await use()
    },
    { auto: true }
  ]
})
