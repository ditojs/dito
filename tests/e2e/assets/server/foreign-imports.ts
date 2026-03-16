import path from 'path'
import {
  test, expect, fixturesDir, suppressErrors
} from '../fixtures.js'
import { AssetWidget } from '../models/AssetWidget.js'
import { AssetFile } from '@ditojs/server'

function getAssetModel() {
  return AssetWidget.app!.getModel('Asset')
}

test(
  'B11: import from allowed file:// URL',
  async () => {
    const fileUrl = `file://${
      path.resolve(fixturesDir, 'tiny.png')
    }`
    const key = AssetFile.getUniqueKey('tiny.png')
    const AssetModel = getAssetModel()

    await AssetWidget.query()
      .insert({
        files: [{
          key,
          name: 'tiny.png',
          type: 'image/png',
          size: 67,
          url: fileUrl
        }]
      })

    // Asset should have been imported
    const asset = await AssetModel.query()
      .findOne({ key })
    expect(asset).toBeDefined()
    expect(asset!.count).toBe(1)
    expect(asset!.file.name).toBe('tiny.png')
  }
)

test(
  'B12: import from allowed http(s) URL',
  async ({ url }) => {
    const httpUrl = `${url}/fixtures/tiny.png`
    const key = AssetFile.getUniqueKey('tiny.png')
    const AssetModel = getAssetModel()

    await AssetWidget.query()
      .insert({
        files: [{
          key,
          name: 'tiny.png',
          type: 'image/png',
          size: 67,
          url: httpUrl
        }]
      })

    const asset = await AssetModel.query()
      .findOne({ key })
    expect(asset).toBeDefined()
    expect(asset!.count).toBe(1)
  }
)

test(
  'B13: reject disallowed import source',
  async () => {
    const key = AssetFile.getUniqueKey('tiny.png')

    await expect(
      AssetWidget.query().insert({
        files: [{
          key,
          name: 'tiny.png',
          type: 'image/png',
          size: 67,
          url: 'https://evil.example.com/file.png'
        }]
      })
    ).rejects.toThrow()
  }
)

test(
  'B20: import from allowed file:// URL via API POST',
  async ({ url }) => {
    const fileUrl = `file://${
      path.resolve(fixturesDir, 'tiny.png')
    }`
    const key = AssetFile.getUniqueKey('tiny.png')
    const AssetModel = getAssetModel()

    const resp = await fetch(
      `${url}/api/asset-widgets`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: [{
            key,
            name: 'tiny.png',
            type: 'image/png',
            size: 67,
            url: fileUrl
          }]
        })
      }
    )

    expect(resp.ok).toBe(true)
    const asset = await AssetModel.query()
      .findOne({ key })
    expect(asset).toBeDefined()
    expect(asset!.count).toBe(1)
  }
)

test(
  'B21: import from allowed http URL via API PATCH',
  async ({ url }) => {
    const httpUrl = `${url}/fixtures/tiny.png`
    const key = AssetFile.getUniqueKey('tiny.png')
    const AssetModel = getAssetModel()

    // First create a widget with a normally uploaded file
    const uploadedFile = await (async () => {
      const filePath = path.resolve(
        fixturesDir, 'tiny.png'
      )
      const fileBuffer = await (
        await import('fs/promises')
      ).readFile(filePath)
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
      return (await resp.json())[0]
    })()

    const createResp = await fetch(
      `${url}/api/asset-widgets`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: [uploadedFile]
        })
      }
    )
    const created = await createResp.json()
    const id = created.id

    // Now PATCH with a foreign import URL
    const patchResp = await fetch(
      `${url}/api/asset-widgets/${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: [{
            key,
            name: 'tiny.png',
            type: 'image/png',
            size: 67,
            url: httpUrl
          }]
        })
      }
    )

    expect(patchResp.ok).toBe(true)
    const asset = await AssetModel.query()
      .findOne({ key })
    expect(asset).toBeDefined()
    expect(asset!.count).toBe(1)
  }
)

test(
  'B22: reject disallowed import source via API',
  async ({ url }) => {
    const app = AssetWidget.app!
    const resp = await suppressErrors(
      app,
      () => fetch(
        `${url}/api/asset-widgets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            files: [{
              key: AssetFile.getUniqueKey('evil.png'),
              name: 'evil.png',
              type: 'image/png',
              size: 1024,
              url: 'https://evil.example.com/file.png'
            }]
          })
        }
      )
    )

    expect(resp.ok).toBe(false)
  }
)

test(
  'B23: reject disallowed file:// URL via API',
  async ({ url }) => {
    const app = AssetWidget.app!
    const resp = await suppressErrors(
      app,
      () => fetch(
        `${url}/api/asset-widgets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            files: [{
              key: AssetFile.getUniqueKey('passwd'),
              name: 'passwd',
              type: 'text/plain',
              size: 1024,
              url: 'file:///etc/passwd'
            }]
          })
        }
      )
    )

    expect(resp.ok).toBe(false)
  }
)

test(
  'B24: reject path traversal out of allowed directory',
  async ({ url }) => {
    const app = AssetWidget.app!
    const traversalUrl = `file://${
      fixturesDir
    }/../../package.json`
    const resp = await suppressErrors(
      app,
      () => fetch(
        `${url}/api/asset-widgets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            files: [{
              key: AssetFile.getUniqueKey(
                'package.json'
              ),
              name: 'package.json',
              type: 'application/json',
              size: 1024,
              url: traversalUrl
            }]
          })
        }
      )
    )

    expect(resp.ok).toBe(false)
  }
)

test(
  'B14: deduplication on import',
  async () => {
    const fileUrl = `file://${
      path.resolve(fixturesDir, 'tiny.png')
    }`
    const key = AssetFile.getUniqueKey('tiny.png')
    const AssetModel = getAssetModel()

    // Insert first record with this key
    await AssetWidget.query().insert({
      files: [{
        key,
        name: 'tiny.png',
        type: 'image/png',
        size: 67,
        url: fileUrl
      }]
    })

    // Insert second record with same key
    await AssetWidget.query().insert({
      files: [{
        key,
        name: 'tiny.png',
        type: 'image/png',
        size: 67,
        url: fileUrl
      }]
    })

    // Should be only one asset record, count=2
    const assets = await AssetModel.query()
      .where({ key })
    expect(assets).toHaveLength(1)
    expect(assets[0].count).toBe(2)
  }
)
