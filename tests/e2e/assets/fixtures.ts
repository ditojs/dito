import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { Page } from '@playwright/test'
import {
  test as base,
  expect
} from '@playwright/test'
import {
  AdminController,
  ModelController,
  Model,
  AssetModel
} from '@ditojs/server'

// AssetModel is created via a mixin and has an
// empty .name, so we extend it to get a proper
// named class that Application.addModels() can
// register under the key 'Asset'.
class Asset extends AssetModel {}
import serve from 'koa-static'
import mount from 'koa-mount'
import {
  createTestApp,
  getAppUrl,
  stubSession
} from '../../utils/app.js'
import {
  createTestDatabase
} from '../../utils/database.js'
import { waitForUrl } from '../../utils/net.js'
import { AssetWidget } from './models/AssetWidget.js'
import { NestedAssetWidget } from './models/NestedAssetWidget.js'

export { expect }
export {
  getInput,
  getContainer
} from '../../utils/admin.js'

export const fixturesDir = path.resolve(
  import.meta.dirname, 'fixtures'
)

// Worker-scoped fixture: one app per worker,
// shared across all spec files in that worker.
export const test = base.extend<
  { url: string },
  { workerUrl: string }
>({
  workerUrl: [async ({}, use) => {
    const tmpDir = await fs.mkdtemp(
      path.join(
        os.tmpdir(), 'dito-e2e-uploads-'
      )
    )

    const app = createTestApp({
      models: {
        AssetWidget,
        NestedAssetWidget,
        Asset
      },
      admin: {
        root: path.resolve(
          import.meta.dirname, 'app'
        ),
        api: { url: '/api/' }
      },
      controllers: {
        admin: AdminController,
        api: {
          AssetWidgets: class extends ModelController {
            override modelClass = AssetWidget
            collection = {
              allow: ['get', 'post'] as const
            }
            member = {
              allow: [
                'get', 'patch', 'delete'
              ] as const
            }
            assets = {
              files: { storage: 'test' },
              file: { storage: 'test' },
              filesSmall: { storage: 'test' }
            }
          },
          NestedAssetWidgets: class extends ModelController {
            override modelClass = NestedAssetWidget
            collection = {
              allow: ['get', 'post'] as const
            }
            member = {
              allow: [
                'get', 'patch', 'delete'
              ] as const
            }
            assets = true
          }
        }
      },
      config: {
        storages: {
          test: {
            type: 'disk',
            path: tmpDir,
            url: '/uploads',
            allowedImports: [
              `file://${fixturesDir}/**`
            ]
          }
        },
        assets: {
          cleanupTimeThreshold: '0s',
          danglingTimeThreshold: '24h'
        }
      }
    })

    stubSession(app)

    // Serve uploaded files at /uploads
    app.use(mount('/uploads', serve(tmpDir)))

    // Serve fixture files at /fixtures (for
    // HTTP import tests)
    app.use(
      mount('/fixtures', serve(fixturesDir))
    )

    await createTestDatabase(app)
    await app.start()
    const url = getAppUrl(app)

    // Update storage config with actual port.
    // Storage._getUrl() requires an absolute base
    // URL, and allowedImports uses the actual port
    // for HTTP import tests (B12).
    const storage = app.getStorage('test')
    storage.url = `${url}/uploads`
    storage.config.allowedImports.push(
      `${url}/fixtures/**`
    )

    await waitForUrl(`${url}/admin/`)
    await use(url)
    // Suppress errors during teardown — closing
    // connections triggers expected "Premature
    // close" errors from in-flight responses.
    app.off('error', app.logError)
    app.server?.closeAllConnections()
    await app.stop()
    await app.knex?.destroy()
    await fs.rm(
      tmpDir, { recursive: true, force: true }
    )
  }, { scope: 'worker' }],

  url: async ({ workerUrl }, use) => {
    await use(workerUrl)
  }
})

export function createModelHelpers<
  M extends typeof Model
>(
  ModelClass: M,
  resource: string,
  defaults: Record<string, unknown> = {}
) {
  async function seed(
    data: Record<string, unknown> = {}
  ) {
    const instance = await ModelClass.query()
      .insert({ ...defaults, ...data })
    return instance.$id() as number
  }

  async function saveAndFetch(
    page: Page,
    id: number
  ): Promise<InstanceType<M>> {
    const saved = page.waitForResponse(resp =>
      resp.url().includes(
        `/api/${resource}/${id}`
      ) &&
      resp.request().method() === 'PATCH' &&
      resp.ok()
    )
    await page.locator(
      'button.dito-button[type="submit"]'
    ).first().click()
    await saved
    const instance = await ModelClass.query()
      .findById(id)
    if (!instance) {
      throw new Error(
        `${ModelClass.name} ${id} not found`
      )
    }
    return instance as InstanceType<M>
  }

  return { seed, saveAndFetch }
}

/**
 * Upload a file to the upload component and
 * wait for the upload response.
 */
export async function uploadFile(
  page: Page,
  filePath: string
) {
  const responsePromise = page.waitForResponse(
    resp =>
      resp.url().includes('/upload/') &&
      resp.ok()
  )
  const fileInput = page.locator(
    '.dito-upload input[type="file"]'
  ).first()
  await fileInput.setInputFiles(filePath)
  await responsePromise
}

/**
 * Upload a file to a specific upload component
 * (identified by its container selector) and
 * wait for the upload response.
 */
export async function uploadFileTo(
  page: Page,
  containerSelector: string,
  filePath: string
) {
  const responsePromise = page.waitForResponse(
    resp =>
      resp.url().includes('/upload/') &&
      resp.ok()
  )
  const fileInput = page.locator(
    containerSelector
  ).locator('input[type="file"]')
  await fileInput.setInputFiles(filePath)
  await responsePromise
}

/**
 * Upload a file via the server API and return
 * its metadata. Used by server and programmatic
 * tests that don't need a browser.
 */
export async function uploadViaApi(
  url: string
) {
  const filePath = path.resolve(
    fixturesDir, 'tiny.png'
  )
  const fileBuffer = await fs.readFile(filePath)
  const file = new File(
    [fileBuffer], 'tiny.png',
    { type: 'image/png' }
  )
  const form = new FormData()
  form.append('files', file)

  const resp = await fetch(
    `${url}/api/asset-widgets/upload/files`,
    { method: 'POST', body: form }
  )
  const body = await resp.json()
  return body[0]
}

/**
 * Temporarily suppress server error logging
 * during a callback. Use this around operations
 * that are expected to trigger server errors
 * (e.g. invalid uploads, premature closes).
 */
export async function suppressErrors<T>(
  app: { off: Function; on: Function;
    logError: Function },
  fn: () => Promise<T>
): Promise<T> {
  const noop = () => {}
  app.off('error', app.logError)
  app.on('error', noop)
  try {
    return await fn()
  } finally {
    app.off('error', noop)
    app.on('error', app.logError)
  }
}

test.describe.configure({ mode: 'serial' })
