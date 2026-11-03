import {
  test,
  expect,
  uploadViaApi,
  scan,
  deleteUnusedAssets,
  getStorage,
  db,
  Asset
} from '../fixtures.js'

// The storage on Postgres through HTTP: uploads, writes of the files into
// jsonb columns, and the scan and release of the asset jobs. The unit tests
// of `@ditojs/storage` cover the details.

async function write(url: string, method: string, path: string, body: unknown) {
  const response = await fetch(`${url}/api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  expect(response.ok).toBe(true)
  return response.json()
}

const getAsset = (key: string) => db.findOne(Asset, { key })

test.describe('assets on the server', () => {
  test('a scan finds the uploads that rows reference', async ({ url }) => {
    const file = await uploadViaApi(url)
    const isUnreferenced = async () =>
      (await scan()).unreferenced.some(asset => asset.key === file.key)
    expect(await isUnreferenced()).toBe(true)
    const widget = await write(url, 'POST', 'asset-widgets', { file })
    expect(widget.file).toEqual(file)
    expect(await isUnreferenced()).toBe(false)
    expect((await getAsset(file.key))!.unreferencedSince).toBe(null)
  })

  test('a release deletes the files that a patch removes', async ({ url }) => {
    const file1 = await uploadViaApi(url)
    const file2 = await uploadViaApi(url)
    const { id } = await write(url, 'POST', 'asset-widgets', {
      files: [file1]
    })
    await write(url, 'PATCH', `asset-widgets/${id}`, { files: [file2] })
    const { released } = await deleteUnusedAssets()
    expect(released).toContainEqual({ key: file1.key, storage: 'test' })
    expect(await getAsset(file1.key)).toBe(null)
    expect(await getAsset(file2.key)).not.toBe(null)
    const keys = await getStorage().listKeys()
    expect(keys).toContain(file2.key)
    expect(keys).not.toContain(file1.key)
  })

  test('uploads and imports files at wildcard paths', async ({ url }) => {
    const uploaded = await uploadViaApi(
      url,
      'nested-asset-widgets/upload/sections/0/items/1/items/2/image'
    )
    const imported = { key: 'tiny', url: `${url}/fixtures/tiny.png` }
    const { sections } = await write(url, 'POST', 'nested-asset-widgets', {
      sections: [
        { items: [{ items: [{ image: uploaded }, { image: imported }] }] }
      ]
    })
    const [first, second] = sections[0].items[0].items
    expect(first.image).toEqual(uploaded)
    expect(second.image).toMatchObject({ type: 'image/png', width: 1 })
    expect(second.image.key).not.toBe('tiny')
    expect(await getStorage().listKeys()).toContain(second.image.key)
  })
})
