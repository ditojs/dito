import {
  test, expect, uploadViaApi
} from '../fixtures.js'
import { AssetWidget } from '../models/AssetWidget.js'

function getAssetModel() {
  return AssetWidget.app!.getModel('Asset')
}

test.describe('asset lifecycle', () => {
  test(
    'insert increments asset count',
    async ({ url }) => {
      const fileObj = await uploadViaApi(url)
      const AssetModel = getAssetModel()

      // Verify count starts at 0
      let asset = await AssetModel.query()
        .findOne({ key: fileObj.key })
      expect(asset!.count).toBe(0)

      // Insert model with this file
      await AssetWidget.query()
        .insert({ files: [fileObj] })

      // Count should now be 1
      asset = await AssetModel.query()
        .findOne({ key: fileObj.key })
      expect(asset!.count).toBe(1)
    }
  )

  test(
    'update tracks added/removed',
    async ({ url }) => {
      const file1 = await uploadViaApi(url)
      const file2 = await uploadViaApi(url)
      const AssetModel = getAssetModel()

      // Insert with file1
      const widget = await AssetWidget.query()
        .insert({ files: [file1] })
      const id = widget.$id()

      // Update: remove file1, add file2
      await AssetWidget.query()
        .patchAndFetchById(id, {
          files: [file2]
        })

      const asset1 = await AssetModel.query()
        .findOne({ key: file1.key })
      expect(asset1!.count).toBe(0)

      const asset2 = await AssetModel.query()
        .findOne({ key: file2.key })
      expect(asset2!.count).toBe(1)
    }
  )

  test(
    'delete decrements asset count',
    async ({ url }) => {
      const fileObj = await uploadViaApi(url)
      const AssetModel = getAssetModel()

      const widget = await AssetWidget.query()
        .insert({ files: [fileObj] })
      const id = widget.$id()

      let asset = await AssetModel.query()
        .findOne({ key: fileObj.key })
      expect(asset!.count).toBe(1)

      await AssetWidget.query().deleteById(id)

      asset = await AssetModel.query()
        .findOne({ key: fileObj.key })
      expect(asset!.count).toBe(0)
    }
  )

  test(
    'shared asset reference counting',
    async ({ url }) => {
      const fileObj = await uploadViaApi(url)
      const AssetModel = getAssetModel()

      // Two records reference the same file
      const w1 = await AssetWidget.query()
        .insert({ files: [fileObj] })
      const w2 = await AssetWidget.query()
        .insert({ files: [fileObj] })

      let asset = await AssetModel.query()
        .findOne({ key: fileObj.key })
      expect(asset!.count).toBe(2)

      // Delete one
      await AssetWidget.query()
        .deleteById(w1.$id())

      asset = await AssetModel.query()
        .findOne({ key: fileObj.key })
      expect(asset!.count).toBe(1)

      // Cleanup: delete second widget
      await AssetWidget.query()
        .deleteById(w2.$id())
    }
  )

  test(
    'orphan cleanup removes file and record',
    async ({ url }) => {
      const fileObj = await uploadViaApi(url)
      const AssetModel = getAssetModel()

      // Insert then delete to make count=0
      const widget = await AssetWidget.query()
        .insert({ files: [fileObj] })
      await AssetWidget.query()
        .deleteById(widget.$id())

      // Backdate timestamps via raw Knex to bypass
      // the TimeStampedMixin before:update hook
      // which always sets updatedAt = now().
      // This makes the asset eligible for cleanup
      // (danglingTimeThreshold is 24h).
      await AssetModel.knex()
        .table(AssetModel.tableName)
        .where({ key: fileObj.key })
        .update({
          createdAt: new Date(0),
          updatedAt: new Date(0)
        })

      // Manually trigger cleanup
      const app = AssetWidget.app!
      await app.releaseUnusedAssets()

      const asset = await AssetModel.query()
        .findOne({ key: fileObj.key })
      expect(asset).toBeUndefined()
    }
  )

  test(
    'dangling protection for new uploads',
    async ({ url }) => {
      const fileObj = await uploadViaApi(url)
      const AssetModel = getAssetModel()

      // File was just uploaded (count=0) but
      // should NOT be cleaned up because
      // danglingTimeThreshold is 24h
      const app = AssetWidget.app!
      await app.releaseUnusedAssets()

      const asset = await AssetModel.query()
        .findOne({ key: fileObj.key })
      expect(asset).toBeDefined()
      expect(asset!.count).toBe(0)
    }
  )
})
