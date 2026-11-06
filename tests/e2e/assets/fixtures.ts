import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { expect, type Page } from '@playwright/test'
import type { EntityClass } from '@mikro-orm/postgresql'
import type { Kysely } from 'kysely'
import { createMikroAdapter } from '@ditojs/mikro'
import { createAssets, createStorages, type AssetField } from '@ditojs/storage'
import { serveFolder } from '../../utils/app.js'
import { Asset } from '../../utils/entities.js'
import { db, defineScenario, getOrm } from '../../utils/fixture-app.js'
import { AssetWidget } from './models/AssetWidget.js'
import { NestedAssetWidget } from './models/NestedAssetWidget.js'

export { expect, Asset, db }
export { getInput, getContainer } from '../../utils/admin.js'

export const fixturesDir = path.resolve(import.meta.dirname, 'fixtures')

const assetWidget = { entity: AssetWidget, table: 'asset_widget' }

// Where the tables store their files, by the snake case names of their tables
// and columns.
export const assetFields: AssetField[] = [
  { ...assetWidget, column: 'files', dataPath: '', storage: 'test' },
  { ...assetWidget, column: 'file', dataPath: '', storage: 'test' },
  { ...assetWidget, column: 'files_small', dataPath: '', storage: 'test' },
  {
    entity: NestedAssetWidget,
    table: 'nested_asset_widget',
    column: 'sections',
    dataPath: '*/items/*/items/*/image',
    storage: 'test'
  }
]

// The folder of the stored files, one per worker.
const uploadsDir = path.join(os.tmpdir(), `dito-e2e-uploads-${process.pid}`)
// The host matches any port, as `setup()` learns it only later.
const allowedImports = [`file://${fixturesDir}/**`, 'http://*/fixtures/**']
const storages = createStorages({
  test: { type: 'disk', path: uploadsDir, url: '/uploads', allowedImports }
})

export const getStorage = () => storages.get('test')

// The Kysely instance of the ORM, for the work outside of requests.
const adapter = {
  getKysely: () => getOrm().em.getKysely() as unknown as Kysely<any>
}
const assets = createAssets({ adapter, fields: assetFields, storages })

/** Finds the unreferenced files, as the nightly scan does. */
export async function scan() {
  return (await assets.runJobs()).scan
}

/** Scans, and releases the files that no row references any more. */
export async function deleteUnusedAssets() {
  // The release keeps the files of the last hour.
  await db.nativeUpdate(Asset, {}, { createdAt: new Date(0) })
  return createAssets({
    adapter,
    fields: assetFields,
    storages,
    deleteUnusedAfter: 0
  }).runJobs()
}

// Serves uploaded files at /uploads, and the fixture files at /fixtures for
// the HTTP import tests.
export const test = defineScenario({
  dirname: import.meta.dirname,
  entities: [AssetWidget, NestedAssetWidget, Asset],
  // The writes of the app's adapter track their files.
  users: orm => {
    const adapter = createMikroAdapter(orm)
    createAssets({ adapter, fields: assetFields, storages })
    return { adapter, controllers: [] }
  },
  controllers: {
    AssetWidget: { mixins: [assets.defineUploads()] },
    NestedAssetWidget: { mixins: [assets.defineUploads()] },
    Asset: false
  },
  handlers: [
    serveFolder('/uploads', uploadsDir),
    serveFolder('/fixtures', fixturesDir)
  ],
  setup: url => {
    // The storage's urls need an absolute base URL, with a trailing slash to
    // keep its path.
    getStorage().url = `${url}/uploads/`
  },
  teardown: () => fs.rm(uploadsDir, { recursive: true, force: true })
})

/** Uploads a file through the API and returns its file object. */
export async function uploadViaApi(
  url: string,
  route = 'asset-widgets/upload/files'
) {
  const filePath = path.resolve(fixturesDir, 'tiny.png')
  const fileBuffer = await fs.readFile(filePath)
  const file = new File([fileBuffer], 'tiny.png', { type: 'image/png' })
  const form = new FormData()
  form.append('files', file)

  const resp = await fetch(`${url}/api/${route}`, {
    method: 'POST',
    body: form
  })
  const body = await resp.json()
  return body[0]
}

/**
 * Returns `seed` and `saveAndFetch` helpers for an entity and its REST
 * resource.
 */
export function createModelHelpers<T extends { id: number }>(
  entity: EntityClass<T>,
  resource: string,
  defaults: Record<string, unknown> = {}
) {
  async function seed(data: Record<string, unknown> = {}) {
    const row = await db.insert(entity, { ...defaults, ...data } as never)
    return row.id
  }

  async function saveAndFetch(page: Page, id: number): Promise<T> {
    const saved = page.waitForResponse(
      resp => (
        resp.url().includes(`/api/${resource}/${id}`) &&
        resp.request().method() === 'PATCH' &&
        resp.ok()
      )
    )
    await page.locator('button.dito-button[type="submit"]').first().click()
    await saved
    const row = await db.findOne(entity, { id } as never)
    if (!row) {
      throw new Error(`${entity.name} ${id} not found`)
    }
    return row as T
  }

  return { seed, saveAndFetch }
}

test.describe.configure({ mode: 'serial' })
