import path from 'path'
import { AdminController, ModelController } from '@ditojs/server'
import {
  createFixtureAppFixture,
  createModelHelpers
} from '../../utils/fixture-app.js'
import { Tag } from './models/Tag.js'
import { Widget } from './models/Widget.js'

export { expect } from '@playwright/test'
export { createModelHelpers, Tag, Widget }

class Widgets extends ModelController {
  override modelClass = Widget
  // `^withTags` forces the model's `withTags` scope on every query so GETs
  // re-hydrate the relation. `graph = true` switches PATCH/POST to the
  // graph variants (patchDitoGraphAndFetch) so `tags: [...]` in the body
  // actually writes through to the WidgetTag join table.
  override scope = ['^withTags']
  override graph = true
  collection = {
    allow: ['get', 'post'] as const
  }
  member = {
    allow: ['get', 'patch', 'delete'] as const
  }
}

class Tags extends ModelController {
  override modelClass = Tag
  collection = {
    allow: ['get', 'post'] as const
  }
  member = {
    allow: ['get', 'patch', 'delete'] as const
  }
}

export const test = createFixtureAppFixture({
  appRoot: path.resolve(import.meta.dirname, 'app'),
  models: { Widget, Tag },
  controllers: {
    admin: AdminController,
    api: { Widgets, Tags }
  },
  setupHook: async app => {
    // Dito's `buildThrough` auto-derives the join table as
    // `${fromName}${toName}` (declaration order, not alphabetical) —
    // since the relation is `Widget.tags`, the table is `WidgetTag`.
    await app.knex.schema.createTable('WidgetTag', table => {
      table.increments('id').primary()
      table.integer('widgetId').unsigned().references('id').inTable('Widget')
      table.integer('tagId').unsigned().references('id').inTable('Tag')
    })
  },
  warmupPath: '/admin/widgets'
}).extend<{ seedTags: void }>({
  // Auto-runs before every test. Tests share one PGlite DB per worker
  // (Playwright runs in-file tests sequentially), so reset before seeding.
  //
  // The `url: _url` parameter looks unused, but it isn't — Playwright
  // fixtures only initialize on request, and requesting `url` here is what
  // triggers the worker fixture chain that boots the embedded app and
  // binds models to in-process knex. Without it, `Widget.query()` and
  // `Tag.query()` below would throw "no database connection".
  seedTags: [
    async ({ url: _url }, use) => {
      // Clear join table first to avoid FK violations.
      await Widget.knex().table('WidgetTag').delete()
      await Widget.query().delete()
      await Tag.query().delete()
      await Tag.query().insert([
        { name: 'tag-1' },
        { name: 'tag-2' },
        { name: 'tag-3' }
      ])
      await use()
    },
    { auto: true }
  ]
})
