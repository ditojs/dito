import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { test as base, expect } from '@playwright/test'
import { AdminController, ModelController, AssetModel } from '@ditojs/server'
import serve from 'koa-static'
import mount from 'koa-mount'
import {
  startTestApp,
  bootTestDb,
  startAndWaitForAdmin,
  teardownTestApp
} from '../../utils/fixture-app.js'
import { AssetWidget } from './models/AssetWidget.js'
import { NestedAssetWidget } from './models/NestedAssetWidget.js'

// AssetModel is created via a mixin and has an empty `.name`, so we extend
// it to get a proper named class that Application.addModels() can register
// under the key 'Asset'.
class Asset extends AssetModel {}

export { expect }
export { getInput, getContainer } from '../../utils/admin.js'

export const fixturesDir = path.resolve(import.meta.dirname, 'fixtures')

// Worker-scoped fixture: one app per worker, shared across all spec files
// in that worker. Uses the shared lifecycle primitives plus this scenario's
// custom storage config + middleware mounts.
export const test = base.extend<{ url: string }, { workerUrl: string }>({
  workerUrl: [
    async ({}, use) => {
      const tmpDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'dito-e2e-uploads-')
      )
      try {
        const app = startTestApp({
          appRoot: path.resolve(import.meta.dirname, 'app'),
          models: { AssetWidget, NestedAssetWidget, Asset },
          controllers: {
            admin: AdminController,
            api: {
              AssetWidgets: class extends ModelController {
                override modelClass = AssetWidget
                collection = { allow: ['get', 'post'] as const }
                member = {
                  allow: ['get', 'patch', 'delete'] as const
                }
                assets = {
                  files: { storage: 'test' },
                  file: { storage: 'test' },
                  filesSmall: { storage: 'test' }
                }
              },
              NestedAssetWidgets: class extends ModelController {
                override modelClass = NestedAssetWidget
                collection = { allow: ['get', 'post'] as const }
                member = {
                  allow: ['get', 'patch', 'delete'] as const
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
                allowedImports: [`file://${fixturesDir}/**`]
              }
            },
            assets: {
              cleanupTimeThreshold: '0s',
              danglingTimeThreshold: '24h'
            }
          }
        })

        // Serve uploaded files at /uploads, fixture files at /fixtures
        // (for HTTP import tests). Mounts must run before app.start.
        app.use(mount('/uploads', serve(tmpDir)))
        app.use(mount('/fixtures', serve(fixturesDir)))

        await bootTestDb(app)
        const url = await startAndWaitForAdmin(app)

        // Update storage config with the actual port. Storage._getUrl()
        // requires an absolute base URL, and allowedImports uses the
        // actual port for HTTP import tests (B12).
        const storage = app.getStorage('test')
        storage.url = `${url}/uploads`
        storage.config.allowedImports.push(`${url}/fixtures/**`)

        try {
          await use(url)
        } finally {
          await teardownTestApp(app)
        }
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true })
      }
    },
    { scope: 'worker' }
  ],

  url: async ({ workerUrl }, use) => {
    await use(workerUrl)
  }
})

/**
 * Upload a file via the server API and return its metadata. Used by server
 * and programmatic tests that don't need a browser.
 */
export async function uploadViaApi(url: string) {
  const filePath = path.resolve(fixturesDir, 'tiny.png')
  const fileBuffer = await fs.readFile(filePath)
  const file = new File([fileBuffer], 'tiny.png', { type: 'image/png' })
  const form = new FormData()
  form.append('files', file)

  const resp = await fetch(`${url}/api/asset-widgets/upload/files`, {
    method: 'POST',
    body: form
  })
  const body = await resp.json()
  return body[0]
}

/**
 * Temporarily suppress server error logging during a callback. Use this
 * around operations that are expected to trigger server errors (e.g.
 * invalid uploads, premature closes).
 */
export async function suppressErrors<T>(
  app: { off: Function; on: Function; logError: Function },
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
