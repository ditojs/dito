import path from 'path'
import { AdminController, ModelController } from '@ditojs/server'
import {
  createFixtureAppFixture,
  createModelHelpers
} from '../../utils/fixture-app.js'
import { Widget } from './models/Widget.js'

export { expect } from '@playwright/test'
export { createModelHelpers, Widget }

class Widgets extends ModelController {
  override modelClass = Widget
  collection = {
    allow: ['get', 'post'] as const
  }
  member = {
    allow: ['get', 'patch', 'delete'] as const
  }
}

export const test = createFixtureAppFixture({
  appRoot: path.resolve(import.meta.dirname, 'app'),
  models: { Widget },
  controllers: {
    admin: AdminController,
    api: { Widgets }
  },
  warmupPath: '/admin/widgets'
}).extend<{ seedWidgets: void }>({
  // Auto-runs before every test in this scenario. Tests share one PGlite
  // DB per worker (Playwright runs in-file tests sequentially), so reset
  // before seeding to keep tests independent.
  //
  // The `url: _url` parameter looks unused, but it isn't — Playwright
  // fixtures only initialize on request, and requesting `url` here is
  // what triggers the worker-fixture chain that boots the embedded app
  // and binds `Widget` to the in-process knex. Without this dependency,
  // `Widget.query()` below would throw "no database connection". The `_`
  // prefix tells the linter the value is intentionally unused.
  seedWidgets: [
    async ({ url: _url }, use) => {
      await Widget.query().delete()
      await Widget.query().insert([
        { name: 'Alpha', published: true },
        { name: 'Beta', published: false }
      ])
      await use()
    },
    { auto: true }
  ]
})
