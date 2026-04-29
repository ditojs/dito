import { test as base, type Browser, type Page } from '@playwright/test'
import type { Model } from '@ditojs/server'
import {
  createTestApp,
  getAppUrl,
  stubSession
} from './app.js'
import { createTestDatabase } from './database.js'
import { waitForUrl } from './net.js'

type TestApp = ReturnType<typeof createTestApp>

interface StartTestAppOptions {
  appRoot: string
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
      root: opts.appRoot,
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

/** Visit `${url}${path}` once to warm the admin's Vite dev server so the
 * first per-test navigation doesn't pay a cold-compile cost. */
export async function warmAdmin(
  browser: Browser,
  url: string,
  path: string
): Promise<void> {
  const page = await browser.newPage()
  try {
    await page.goto(`${url}${path}`, { waitUntil: 'networkidle' })
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

export interface FixtureAppOptions {
  /** Absolute path to the scenario's `app/` directory (the admin entrypoint). */
  appRoot: string
  /** Models to register on the embedded app. */
  models: Record<string, typeof Model>
  /** Controllers to register on the embedded app. */
  controllers: Record<string, unknown>
  /** Optional extra config merged into `createTestApp`'s `config`. */
  config?: Record<string, unknown>
  /** If set, the worker fixture warms the admin Vite bundle by visiting
   * `${url}${warmupPath}` once after the app starts. Avoids first-test
   * cold-compile timeouts in CI. */
  warmupPath?: string
  /** If set, runs after `bootTestDb(app)` and before `app.start()`. Use this
   * to create extra schema (e.g. join tables for many-to-many relations
   * that `createTestDatabase` doesn't auto-derive). */
  setupHook?: (app: TestApp) => Promise<void>
}

/**
 * Returns a Playwright test object whose worker fixture spins up an
 * embedded Dito app (PGlite-backed, Vite-served admin) and exposes its
 * `url`. Composes the primitives above; scenarios with unusual setup
 * (custom storage, mounted middleware, etc.) compose them inline instead.
 */
export function createFixtureAppFixture(opts: FixtureAppOptions) {
  return base.extend<{ url: string }, { workerUrl: string }>({
    workerUrl: [
      async ({ browser }, use) => {
        const app = startTestApp(opts)
        await bootTestDb(app)
        if (opts.setupHook) {
          await opts.setupHook(app)
        }
        const url = await startAndWaitForAdmin(app)
        if (opts.warmupPath) {
          await warmAdmin(browser, url, opts.warmupPath)
        }
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
    }
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
      resp =>
        resp.url().includes(`/api/${resource}/${id}`) &&
        resp.request().method() === 'PATCH' &&
        resp.ok()
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
