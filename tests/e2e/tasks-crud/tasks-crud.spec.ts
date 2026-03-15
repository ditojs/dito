// tests/e2e/tasks-crud/tasks-crud.test.ts
import path from 'path'
import { test, expect } from '@playwright/test'
import {
  AdminController,
  ModelController
} from '@ditojs/server'
import {
  createTestApp,
  getAppUrl,
  stubSession
} from '../../utils/app.js'
import {
  createTestDatabase
} from '../../utils/database.js'
import { waitForUrl } from '../../utils/net.js'
import { Task } from '../fixtures/models/Task.js'

// Controller class name determines the URL path:
// Tasks -> /api/tasks
class Tasks extends ModelController {
  modelClass = Task
  collection = { allow: ['get', 'post'] as const }
  member = { allow: ['get', 'patch', 'delete'] as const }
}

const app = createTestApp({
  models: { Task },
  admin: {
    root: path.resolve(import.meta.dirname, 'app'),
    api: { url: '/api/' }
  },
  controllers: {
    admin: AdminController,
    api: { Tasks }
  }
})

stubSession(app)

let url: string

test.describe('Task CRUD', () => {
  test.beforeAll(async () => {
    await createTestDatabase(app)
    await app.start()
    url = getAppUrl(app)
    await waitForUrl(`${url}/admin/`)
  })

  test.afterAll(async () => {
    await app.stop()
    await app.knex?.destroy()
  })

  test(
    'admin loads successfully',
    async ({ page }) => {
      await page.goto(`${url}/admin/`, {
        waitUntil: 'domcontentloaded'
      })
      await expect(
        page.locator('#dito-admin')
      ).toBeVisible({ timeout: 30_000 })
    }
  )

  test(
    'shows seeded data in list',
    async ({ page }) => {
      await Task.query().insert({
        name: 'Seeded task',
        done: false
      })
      await page.goto(`${url}/admin/tasks`)
      await expect(
        page.getByText('Seeded task')
      ).toBeVisible({ timeout: 30_000 })
    }
  )
})
