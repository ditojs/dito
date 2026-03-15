import path from 'path'
import {
  test, expect, fixturesDir
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
