// tests/server/setup.ts
import { Application } from '@ditojs/server'
import type { Knex } from 'knex'
import { createPGliteKnex } from '../utils/pglite-knex.js'

export { createTestDatabase } from '../utils/database.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestApp = Application & { knex: Knex }

interface TestAppOptions {
  models?: Record<string, any>
  config?: Record<string, any>
  [key: string]: any
}

export function createTestApp({
  models,
  config,
  ...options
}: TestAppOptions = {}): TestApp {
  const { knex } = createPGliteKnex()
  return new Application({
    config: {
      log: { silent: true },
      ...config,
      knex
    },
    models: models ?? {},
    ...options
  }) as TestApp
}

export async function destroyTestApp(app: TestApp) {
  await app.knex?.destroy()
}
