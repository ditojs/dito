import { test as base, type Page } from '@playwright/test'
import type { Model } from '@ditojs/server'
import {
  createTestApp,
  getAppUrl,
  stubSession
} from './app.js'
import { createTestDatabase } from './database.js'
import { waitForUrl } from './net.js'

export interface FixtureAppOptions {
  /** Absolute path to the scenario's `app/` directory (the admin entrypoint). */
  appRoot: string
  /** Models to register on the embedded app. */
  models: Record<string, typeof Model>
  /** Controllers to register on the embedded app. */
  controllers: Record<string, unknown>
  /** Optional extra config merged into `createTestApp`'s `config`. */
  config?: Record<string, unknown>
}

/**
 * Returns a Playwright test object whose worker fixture spins up an
 * embedded Dito app (PGlite-backed, Vite-served admin) and exposes its
 * `url`. Mirrors the boilerplate in `tests/e2e/assets/fixtures.ts`.
 */
export function createFixtureAppFixture(opts: FixtureAppOptions) {
  return base.extend<{ url: string }, { workerUrl: string }>({
    workerUrl: [
      async ({}, use) => {
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
        await createTestDatabase(app)
        await app.start()
        const url = getAppUrl(app)
        await waitForUrl(`${url}/admin/`)

        await use(url)

        // Suppress errors during teardown — closing connections triggers
        // expected "Premature close" errors from in-flight responses.
        app.off('error', app.logError)
        app.server?.closeAllConnections()
        await app.stop()
        await app.knex?.destroy()
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
 * Relocated from `tests/e2e/assets/fixtures.ts`.
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
