import {
  test,
  expect,
  uploadViaApi,
  Asset
} from '../fixtures.js'
import { AssetWidget } from '../models/AssetWidget.js'

test.describe('asset lifecycle', () => {
  test('insert increments asset count', async ({ url }) => {
    const fileObj = await uploadViaApi(url)

    // Verify count starts at 0
    let asset = await Asset.query().findOne({ key: fileObj.key })
    expect(asset!.count).toBe(0)

    // Insert model with this file
    await AssetWidget.query().insert({ files: [fileObj] })

    // Count should now be 1
    asset = await Asset.query().findOne({ key: fileObj.key })
    expect(asset!.count).toBe(1)
  })

  test('update tracks added/removed', async ({ url }) => {
    const file1 = await uploadViaApi(url)
    const file2 = await uploadViaApi(url)

    // Insert with file1
    const widget = await AssetWidget.query().insert({ files: [file1] })
    const id = widget.$id()

    // Update: remove file1, add file2
    await AssetWidget.query().patchAndFetchById(id, {
      files: [file2]
    })

    // `cleanupTimeThreshold` is 0, so file1 is released right away:
    const asset1 = await Asset.query().findOne({ key: file1.key })
    expect(asset1).toBeUndefined()

    const asset2 = await Asset.query().findOne({ key: file2.key })
    expect(asset2!.count).toBe(1)
  })

  test('delete decrements asset count', async ({ url }) => {
    const fileObj = await uploadViaApi(url)

    const widget = await AssetWidget.query().insert({ files: [fileObj] })
    const id = widget.$id()

    let asset = await Asset.query().findOne({ key: fileObj.key })
    expect(asset!.count).toBe(1)

    await AssetWidget.query().deleteById(id)

    // `cleanupTimeThreshold` is 0, so the file is released right away:
    asset = await Asset.query().findOne({ key: fileObj.key })
    expect(asset).toBeUndefined()
  })

  test('shared asset reference counting', async ({ url }) => {
    const fileObj = await uploadViaApi(url)

    // Two records reference the same file
    const w1 = await AssetWidget.query().insert({ files: [fileObj] })
    const w2 = await AssetWidget.query().insert({ files: [fileObj] })

    let asset = await Asset.query().findOne({ key: fileObj.key })
    expect(asset!.count).toBe(2)

    // Delete one
    await AssetWidget.query().deleteById(w1.$id())

    asset = await Asset.query().findOne({ key: fileObj.key })
    expect(asset!.count).toBe(1)

    // Cleanup: delete second widget
    await AssetWidget.query().deleteById(w2.$id())
  })

  test('dangling cleanup removes old uploads', async ({ url }) => {
    const fileObj = await uploadViaApi(url)

    // Backdate the never persisted upload past `danglingTimeThreshold`, via
    // raw knex, as the TimestampedMixin hooks set `updatedAt` to now:
    await Asset.knex()
      .table(Asset.tableName)
      .where({ key: fileObj.key })
      .update({
        createdAt: new Date(0),
        updatedAt: new Date(0)
      })

    // Manually trigger cleanup
    const app = AssetWidget.app!
    await app.releaseUnusedAssets()

    const asset = await Asset.query().findOne({ key: fileObj.key })
    expect(asset).toBeUndefined()
  })

  test('dangling protection for new uploads', async ({ url }) => {
    const fileObj = await uploadViaApi(url)

    // File was just uploaded (count=0) but
    // should NOT be cleaned up because
    // danglingTimeThreshold is 24h
    const app = AssetWidget.app!
    await app.releaseUnusedAssets()

    const asset = await Asset.query().findOne({ key: fileObj.key })
    expect(asset).toBeDefined()
    expect(asset!.count).toBe(0)
  })
})
