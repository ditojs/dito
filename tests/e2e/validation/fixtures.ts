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
}).extend<{ resetWidgets: void }>({
  // Auto-runs before every test in this scenario. Tests share one PGlite
  // DB per worker (Playwright runs in-file tests sequentially), so reset
  // between tests so a row created by one test doesn't leak into another.
  //
  // The `url: _url` parameter looks unused but isn't — Playwright fixtures
  // only initialize on request, and naming `url` here triggers the worker
  // fixture chain that boots the embedded app and binds Widget to the
  // in-process knex. Without it, `Widget.query()` below would throw "no
  // database connection". The `_` prefix tells the linter it's intentional.
  resetWidgets: [
    async ({ url: _url }, use) => {
      await Widget.query().delete()
      await use()
    },
    { auto: true }
  ]
})
