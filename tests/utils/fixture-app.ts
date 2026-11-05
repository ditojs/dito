import path from 'path'
import type { Browser } from '@playwright/test'
import type { MiddlewareHandler } from 'hono'
import { hyphenate } from '@ditojs/utils'
import type { ControllerDefinition } from '@ditojs/server'
import {
  defineModelController,
  type ModelControllerDefinition
} from '@ditojs/mikro'
import type {
  EntityClass,
  EntityManager,
  RequiredEntityData
} from '@mikro-orm/postgresql'
import { test as base } from './browser-errors.js'
import { createTestApp, stubSession, type TestApi } from './app.js'
import type { TestOrm } from './database.js'
import { waitForUrl } from './net.js'

// The settings of a scenario's entity controller, which go over the defaults
// of `scenarioController()`.
export type ScenarioControllerOptions = Partial<
  Omit<ModelControllerDefinition, 'entity'>
>

/**
 * The controller of an entity, at the hyphenated plural of its name, such as
 * `asset-widgets` for `AssetWidget`, which routes the usual CRUD actions and
 * lets anyone in. Scenarios configure finds, filters, mixins, etc. through
 * `options`, whose `actions` add to the CRUD actions.
 */
export function scenarioController(
  entity: EntityClass<any>,
  { actions, ...options }: ScenarioControllerOptions = {}
): ControllerDefinition {
  return defineModelController({
    path: hyphenate(`${entity.name}s`),
    authorize: true,
    ...options,
    actions: {
      'get': true,
      'post': true,
      'get :id': true,
      'patch :id': true,
      'delete :id': true,
      ...actions
    },
    entity
  })
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

export interface ScenarioOptions {
  /** The scenario's directory, usually `import.meta.dirname`. */
  dirname: string
  /** The entities, with the tables that MikroORM's schema generator creates.
   * The tables are emptied before each test. */
  entities: EntityClass<any>[]
  /** The settings of the entities' controllers by entity name, see
   * `scenarioController()`, or `false` for entities without one. */
  controllers?: Record<string, ScenarioControllerOptions | false>
  /** The routes of users to log in with, instead of the stubbed session,
   * such as the ones of `defineUserActions()`. */
  users?: (orm: TestOrm) => TestApi
  /** Merged into the admin's api config, e.g. `users` to log in through
   * `users` instead of the stubbed session. */
  api?: Record<string, unknown>
  /** Hono middleware that runs before the app, such as file servers. */
  handlers?: MiddlewareHandler[]
  /** Runs once the app listens at `url`, e.g. to set URLs of storages. */
  setup?: (url: string) => void | Promise<void>
  /** Runs after the app stopped, e.g. to remove folders. */
  teardown?: () => void | Promise<void>
  /** Runs before each test, after the tables are emptied, e.g. to seed
   * data. */
  beforeEach?: () => Promise<void>
  host?: string
  port?: number
}

// The ORM of the running scenario, which `db` uses. A worker runs one scenario
// at a time.
let currentOrm: TestOrm | null = null

export function getOrm(): TestOrm {
  if (!currentOrm) throw new Error('The app of the scenario is not running')
  return currentOrm
}

const fork = (): EntityManager => getOrm().em.fork()

/**
 * The database of the running scenario, for the tests to prepare and check
 * data. Each call works on a new fork of the entity manager, so reads see what
 * the app wrote meanwhile. `insert()` creates a row with the relations in
 * `data`, as `em.create()` does, and flushes it.
 */
export const db = {
  em: fork,
  async insert<T extends object>(
    entity: EntityClass<T>,
    data: RequiredEntityData<T>
  ): Promise<T> {
    const em = fork()
    const row = em.create(entity, data)
    await em.flush()
    return row
  },
  find: ((...args) => fork().find(...args)) as EntityManager['find'],
  findOne: ((...args) => fork().findOne(...args)) as EntityManager['findOne'],
  count: ((...args) => fork().count(...args)) as EntityManager['count'],
  nativeUpdate: ((...args) =>
    fork().nativeUpdate(...args)) as EntityManager['nativeUpdate']
}

/**
 * Starts the embedded Dito app of a scenario (Postgres-backed, Vite-served
 * admin) and waits for its admin. Returns `reset()`, which empties its tables
 * and seeds them, and `stop()`, which stops it and drops its database.
 */
export async function startScenario({
  dirname,
  entities,
  controllers = {},
  users,
  api: adminApi,
  handlers = [],
  setup,
  teardown,
  beforeEach,
  host,
  port
}: ScenarioOptions) {
  const app = await createTestApp({
    entities,
    api: orm => {
      const own = users?.(orm)
      return {
        ...own,
        controllers: [
          ...entities.flatMap(entity => {
            const options = controllers[entity.name]
            return options === false
              ? []
              : [scenarioController(entity, options)]
          }),
          ...(own?.controllers ?? [])
        ]
      }
    },
    admin: {
      name: path.basename(dirname),
      views: path.join(dirname, 'views.ts'),
      api: adminApi
    },
    // Scenarios with users of their own log in through their routes:
    handlers: adminApi?.users ? handlers : [...handlers, stubSession()],
    host,
    port
  })
  const orm = app.orm!
  currentOrm = orm
  const url = await app.start()
  await waitForUrl(`${url}/admin/`)
  await setup?.(url)

  const reset = async () => {
    await orm.schema.clear()
    await beforeEach?.()
  }

  const stop = async () => {
    // Closing the connections ends the responses in flight, which isn't worth
    // logging.
    app.logErrors = false
    await app.stop()
    currentOrm = null
    await teardown?.()
  }

  return { app, url, reset, stop }
}

/**
 * Returns a Playwright test object for a scenario: one app per worker, exposed
 * through the `url` fixture, with the scenario's models reset before each test.
 */
export function defineScenario(options: ScenarioOptions) {
  let scenario: Awaited<ReturnType<typeof startScenario>>

  const test = base.extend<
    { url: string; reset: void },
    { workerUrl: string }
  >({
    workerUrl: [
      async ({ browser }, use) => {
        scenario = await startScenario(options)
        await warmAdmin(browser, scenario.url)
        try {
          await use(scenario.url)
        } finally {
          await scenario.stop()
        }
      },
      // Starting the app and compiling its admin takes as long as it takes,
      // e.g. while the other workers compile theirs:
      { scope: 'worker', timeout: 0 }
    ],

    url: async ({ workerUrl }, use) => {
      await use(workerUrl)
    },

    // Tests share one database per worker, so reset it before each test.
    // Requesting `url` boots the app and its database.
    reset: [
      async ({ url: _url }, use) => {
        await scenario.reset()
        await use()
      },
      { auto: true }
    ]
  })

  // Expose the options to start the scenario by hand, see `scripts/serve.js`:
  return Object.assign(test, { options })
}
