import path from 'path'
import type { Browser, Page } from '@playwright/test'
import { test as base } from './browser-errors.js'
import {
  AdminController,
  ModelController,
  type ApplicationControllers,
  type Model,
  type ModelControllerActions,
  type ModelControllerMemberActions
} from '@ditojs/server'
import {
  createTestApp,
  getAppUrl,
  stubSession
} from './app.js'
import { createTestDatabase } from './database.js'
import { waitForUrl } from './net.js'

type TestApp = ReturnType<typeof createTestApp>

interface StartTestAppOptions {
  /** The scenario's directory, containing its `views.ts`. */
  dirname: string
  models: Record<string, typeof Model>
  controllers: Record<string, unknown>
  config?: Record<string, unknown>
}

/** Create the embedded app + auth stub. Returns the unstarted app. */
export function startTestApp(opts: StartTestAppOptions): TestApp {
  const app = createTestApp({
    models: opts.models,
    controllers: opts.controllers,
    admin: {
      name: path.basename(opts.dirname),
      views: path.join(opts.dirname, 'views.ts'),
      api: { url: '/api/' }
    },
    config: opts.config
  })
  stubSession(app)
  return app
}

/** Initialise the in-process PGlite schema from the app's models. */
export async function bootTestDb(app: TestApp): Promise<void> {
  await createTestDatabase(app)
}

/** Start the HTTP server and wait for /admin/ to respond. Returns the url. */
export async function startAndWaitForAdmin(app: TestApp): Promise<string> {
  await app.start()
  const url = getAppUrl(app)
  await waitForUrl(`${url}/admin/`)
  return url
}

/** Visit the admin once to warm its Vite dev server, so the first test
 * doesn't pay the cold-compile cost (avoids timeouts in CI). */
export async function warmAdmin(browser: Browser, url: string): Promise<void> {
  const page = await browser.newPage()
  try {
    await page.goto(`${url}/admin/`, { waitUntil: 'networkidle' })
  } finally {
    await page.close()
  }
}

/** Stop the server and release knex/connection resources. */
export async function teardownTestApp(app: TestApp): Promise<void> {
  // Suppress errors during teardown — closing connections triggers
  // expected "Premature close" errors from in-flight responses.
  app.off('error', app.logError)
  app.server?.closeAllConnections()
  await app.stop()
  await app.knex?.destroy()
}

/**
 * Base class for scenario controllers, allowing the usual CRUD actions.
 * Scenarios extend it to configure scopes, graphs, relations, etc.
 */
export class ScenarioController extends ModelController {
  // Typed as actions, so that scenarios can add actions of their own.
  override collection: ModelControllerActions<this> = {
    allow: ['get', 'post']
  }

  override member: ModelControllerMemberActions<this> = {
    allow: ['get', 'patch', 'delete']
  }
}

export interface ScenarioOptions {
  /** The scenario's directory, usually `import.meta.dirname`. */
  dirname: string
  /** Models to register. Rows are deleted before each test, in reverse
   * order, so list related models after the ones they depend on. */
  models: Record<string, typeof Model>
  /** Controllers, keyed by name. Models without a controller named after
   * their plural (e.g. `Widgets` for `Widget`) get a `ScenarioController`. */
  controllers?: ApplicationControllers
  /** Extra tables to clear before the models, e.g. join tables. */
  tables?: string[]
  /** Extra config merged into the app config. */
  config?: Record<string, unknown>
  /** Runs once after the database is created, before the app starts, e.g.
   * to create join tables that `createTestDatabase()` doesn't derive. */
  setup?: (app: TestApp) => Promise<void>
  /** Runs before each test, after the default reset. Use it to clear extra
   * tables or to seed data. */
  beforeEach?: () => Promise<void>
}

/**
 * Returns a Playwright test object for a scenario: one embedded Dito app per
 * worker (PGlite-backed, Vite-served admin), exposed through the `url`
 * fixture, with the scenario's models reset before each test.
 */
export function defineScenario({
  dirname,
  models,
  controllers = {},
  tables = [],
  config,
  setup,
  beforeEach
}: ScenarioOptions) {
  const api: Record<string, unknown> = { ...controllers }
  for (const modelClass of Object.values(models)) {
    const name = `${modelClass.name}s`
    if (!api[name]) {
      // Name the class, as Dito derives the controller's path from it.
      api[name] = Object.defineProperty(
        class extends ScenarioController {
          override modelClass = modelClass
        },
        'name',
        { value: name }
      )
    }
  }
  const modelClasses = Object.values(models).reverse()

  let knex: TestApp['knex']

  return base.extend<{ url: string; reset: void }, { workerUrl: string }>({
    workerUrl: [
      async ({ browser }, use) => {
        const app = startTestApp({
          dirname,
          models,
          controllers: { admin: AdminController, api },
          config
        })
        await bootTestDb(app)
        await setup?.(app)
        knex = app.knex
        const url = await startAndWaitForAdmin(app)
        await warmAdmin(browser, url)
        try {
          await use(url)
        } finally {
          await teardownTestApp(app)
        }
      },
      { scope: 'worker' }
    ],

    url: async ({ workerUrl }, use) => {
      await use(workerUrl)
    },

    // Tests share one database per worker, so reset it before each test.
    // Requesting `url` boots the app, which binds the models to its knex.
    reset: [
      async ({ url: _url }, use) => {
        for (const table of tables) {
          await knex.table(table).delete()
        }
        for (const modelClass of modelClasses) {
          await modelClass.query().delete()
        }
        await beforeEach?.()
        await use()
      },
      { auto: true }
    ]
  })
}

/**
 * Returns `seed` and `saveAndFetch` helpers for a model + REST resource.
 */
export function createModelHelpers<M extends typeof Model>(
  ModelClass: M,
  resource: string,
  defaults: Record<string, unknown> = {}
) {
  async function seed(data: Record<string, unknown> = {}) {
    const instance = await ModelClass.query().insert({ ...defaults, ...data })
    return instance.$id() as number
  }

  async function saveAndFetch(
    page: Page,
    id: number
  ): Promise<InstanceType<M>> {
    const saved = page.waitForResponse(
      resp => (
        resp.url().includes(`/api/${resource}/${id}`) &&
        resp.request().method() === 'PATCH' &&
        resp.ok()
      )
    )
    await page
      .locator('button.dito-button[type="submit"]')
      .first()
      .click()
    await saved
    const instance = await ModelClass.query().findById(id)
    if (!instance) {
      throw new Error(`${ModelClass.name} ${id} not found`)
    }
    return instance as InstanceType<M>
  }

  return { seed, saveAndFetch }
}
