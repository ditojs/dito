import {
  test,
  expect,
  uploadViaApi,
  Asset
} from '../fixtures.js'
import type { AssetFile, AssetFileObject } from '@ditojs/server'
import { AssetWidget } from '../models/AssetWidget.js'

test.describe('model hooks', () => {
  test('insert triggers before:insert hook', async ({ url }) => {
    const fileObj = await uploadViaApi(url)

    await AssetWidget.query().insert({ files: [fileObj] })

    const asset = await Asset.query().findOne({ key: fileObj.key })
    expect(asset!.count).toBe(1)
  })

  test('patch triggers before:update hook', async ({ url }) => {
    const file1 = await uploadViaApi(url)
    const file2 = await uploadViaApi(url)

    const widget = await AssetWidget.query().insert({ files: [file1] })
    const id = widget.$id()

    // Patch: swap file1 for file2
    await AssetWidget.query().patchAndFetchById(id, {
      files: [file2]
    })

    // `deleteUnusedAfter` is 0, so the next run releases file1:
    await AssetWidget.app!.deleteExpiredRecords()
    const asset1 = await Asset.query().findOne({ key: file1.key })
    const asset2 = await Asset.query().findOne({ key: file2.key })
    expect(asset1).toBeUndefined()
    expect(asset2!.count).toBe(1)
  })

  test('modified asset replaces file on disk', async ({ url }) => {
    const fileObj = await uploadViaApi(url)

    const widget = await AssetWidget.query().insert({ files: [fileObj] })
    const id = widget.$id()

    // Read original file content from storage
    const storage = AssetWidget.app!.getStorage('test')
    const originalData = await storage.readFile(fileObj)

    // Server code modifies the loaded files, as the data of files sent by
    // clients is ignored (as data URI, so it is parsed by AssetFile set data):
    const fetched = await AssetWidget.query().findById(id)
    // Loaded files are `AssetFile` instances:
    const file = fetched!.files[0] as AssetFileObject & AssetFile
    const newData = Buffer.from('modified content')
    file.data = `data:text/plain;base64,${newData.toString('base64')}`
    await AssetWidget.query().patchAndFetchById(id, { files: [file] })

    // Read updated file from storage
    const updatedData = await storage.readFile(fileObj)

    // File content should have changed
    expect(updatedData).not.toEqual(originalData)
    // The stored data is the raw bytes written
    // by handleModifiedAssets (the data URI
    // string itself), so it won't equal the
    // original PNG binary.
    expect(updatedData.length).not.toBe(
      originalData.length
    )
  })
})
