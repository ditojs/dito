import fs from 'fs/promises'
import path from 'path'
import {
  test, expect, fixturesDir, suppressErrors
} from '../fixtures.js'
import { AssetWidget } from '../models/AssetWidget.js'

function getAssetModel() {
  return AssetWidget.app!.getModel('Asset')
}

test.describe('upload endpoint', () => {
  test(
    'POST multipart upload returns metadata',
    async ({ url }) => {
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
      expect(resp.ok).toBe(true)

      const body = await resp.json()
      expect(body).toHaveLength(1)
      expect(body[0]).toHaveProperty('key')
      expect(body[0]).toHaveProperty('name',
        'tiny.png'
      )
      expect(body[0]).toHaveProperty('type',
        'image/png'
      )
      expect(body[0]).toHaveProperty('size')
      expect(body[0]).toHaveProperty('url')
      expect(body[0].key).toMatch(
        /^[0-9a-f-]+\.png$/
      )
    }
  )

  test(
    'file stored in nested directory',
    async ({ url }) => {
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
      const key = body[0].key

      // File URL should contain nested path
      expect(body[0].url).toContain(
        `/${key[0]}/${key[1]}/${key}`
      )
    }
  )

  test(
    'asset record created with count=0',
    async ({ url }) => {
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
      const fileKey = body[0].key

      const AssetModel = getAssetModel()
      const asset = await AssetModel.query()
        .findOne({ key: fileKey })
      expect(asset).toBeDefined()
      expect(asset!.count).toBe(0)
      expect(asset!.storage).toBe('test')
      expect(asset!.file.name).toBe('tiny.png')
    }
  )

  test(
    'fileFilter rejects wrong fieldname',
    async ({ url }) => {
      const app = AssetWidget.app!

      const filePath = path.resolve(
        fixturesDir, 'tiny.png'
      )
      const fileBuffer = await fs.readFile(
        filePath
      )
      const file = new File(
        [fileBuffer], 'tiny.png',
        { type: 'image/png' }
      )

      const form = new FormData()
      form.append('wrongfield', file)

      // Suppress the expected server error from
      // the empty query when no files pass the
      // field filter.
      const { resp, body } =
        await suppressErrors(app, async () => {
          const resp = await fetch(
            `${url}/api/asset-widgets/upload/files`,
            { method: 'POST', body: form }
          )
          const body = await resp.json()
          return { resp, body }
        })

      if (Array.isArray(body)) {
        expect(body).toHaveLength(0)
      } else {
        expect(resp.ok).toBe(false)
      }
    }
  )
})
