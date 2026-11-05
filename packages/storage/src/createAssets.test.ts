import {
  HttpError,
  createApi,
  defineController,
  type DitoContext
} from '@ditojs/server'
import { createAssets, type AssetFile } from './index.ts'
import {
  setupAssetTests,
  db,
  archive,
  storages,
  request,
  paths,
  file,
  addImport,
  addBook,
  addAsset,
  getKeys,
  old,
  now,
  adapter,
  handleAdapter
} from './test/assets.ts'

setupAssetTests()

describe('createAssets()', () => {
  const createBookAssets = () =>
    createAssets({
      adapter,
      paths,
      storages,
      deleteUnusedAfter: 24 * 60 * 60 * 1000
    })

  function setup() {
    const assets = createBookAssets()
    const books = defineController({
      path: 'books',
      authorize: true,
      mixins: [assets.defineWrites('book'), assets.defineUploads('book')],
      actions: { post: async ({ body }) => body }
    })
    return createApi({
      controllers: [books],
      adapter: handleAdapter,
      getUser: async () => null,
      onError: () => {}
    })
  }

  it('handles the uploads and the files of writes', async () => {
    const api = setup()
    const body = new FormData()
    body.append('file', new File(['Front'], 'front.txt'))
    const response = await request(api, '/books/upload/cover', {
      method: 'POST',
      body
    })
    const [stored] = await response.json()
    expect(stored).toMatchObject({ name: 'front.txt', size: 5 })
    const written = await request(api, '/books', {
      method: 'POST',
      body: JSON.stringify({ cover: { key: stored.key } }),
      headers: { 'Content-Type': 'application/json' }
    })
    expect(written.status).toBe(200)
    expect(await written.json()).toEqual({ cover: stored })
  })

  it('stores files in storages by name', async () => {
    const file = await createBookAssets().store('archive', {
      name: 'report.txt',
      data: Buffer.from('Report')
    })
    expect(await archive.readFile(file)).toEqual(Buffer.from('Report'))
    expect(
      await db.selectFrom('asset').select(['key', 'storage']).execute()
    ).toEqual([{ key: file.key, storage: 'archive' }])
  })

  it('imports the files of a row', async () => {
    const source = await addImport('source.txt', 'Source')
    const data = { cover: { key: 'seed', url: `file://${source}` } }
    await createBookAssets().import('book', data)
    expect(await getKeys()).toEqual([data.cover.key])
  })

  it('finds references and runs the jobs with the shared options', async () => {
    const assets = createBookAssets()
    await addBook(1, { cover: file('used') })
    await addAsset('used')
    await addAsset('old', { since: old })
    expect(
      (await assets.findReferences({ keys: ['used'] })).map(ref => ref.id)
    ).toEqual([1])
    const { released } = await assets.runJobs({ dryRun: true, now })
    expect(released).toEqual([{ key: 'old', storage: 'covers' }])
  })

  it('takes `deleteUnusedAfter` per call of `runJobs()`', async () => {
    const assets = createBookAssets()
    await addAsset('old', { since: old })
    await addAsset('new', { since: now })
    const release = async (deleteUnusedAfter?: number | false) => {
      const { released } = await assets.runJobs({
        dryRun: true,
        now,
        deleteUnusedAfter
      })
      return released.map(asset => asset.key).sort()
    }
    expect(await release()).toEqual(['old'])
    expect(await release(false)).toEqual([])
    expect(await release(0)).toEqual(['new', 'old'])
  })

  describe('in a request', () => {
    // Runs `fn` in a write of an API with transactions, which rolls back
    // when `fn` throws.
    async function write(fn: (c: DitoContext) => unknown) {
      const api = createApi({
        controllers: [
          defineController({
            path: 'jobs',
            authorize: true,
            actions: { post: ({ c }) => fn(c) }
          })
        ],
        adapter: handleAdapter,
        onError: () => {}
      })
      return request(api, '/jobs', { method: 'POST' })
    }

    it('keeps the rows of stored files when the write rolls back', async () => {
      const assets = createBookAssets()
      let stored: AssetFile | undefined
      const response = await write(async () => {
        const report = { name: 'report.txt', data: Buffer.from('Report') }
        stored = await assets.store('archive', report)
        throw new HttpError(409)
      })
      expect(response.status).toBe(409)
      expect(await getKeys()).toEqual([stored!.key])
      const { released } = await assets.runJobs({ deleteUnusedAfter: 0 })
      expect(released).toMatchObject([{ key: stored!.key, storage: 'archive' }])
      await expect(archive.readFile(stored!)).rejects.toThrow()
    })

    it('finds the references in the transaction of the request', async () => {
      const assets = createBookAssets()
      const response = await write(async c => {
        await c.var.em
          .getKysely()
          .insertInto('book')
          .values({ id: 1, cover: JSON.stringify(file('used')) })
          .execute()
        return assets.findReferences({ c })
      })
      const references = await response.json()
      expect(references.map((ref: { id: number }) => ref.id)).toEqual([1])
    })
  })
})
