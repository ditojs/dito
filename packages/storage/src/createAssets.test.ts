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
  bookPath,
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
  const createBookAssets = (
    deleteUnusedAfter: number | string = 24 * 60 * 60 * 1000
  ) => createAssets({ adapter, paths, storages, deleteUnusedAfter })

  it('throws for asset paths of unknown storages', () => {
    expect(() =>
      createAssets({
        adapter,
        paths: [{ ...bookPath, column: 'cover', path: '', storage: 'x' }],
        storages
      })
    ).toThrow(`Unknown storage 'x'`)
  })

  it('takes paths without an entity, for the jobs of a migration', () => {
    const { entity, ...path } = paths[0]!
    expect(() =>
      createAssets({ adapter, paths: [path], storages })
    ).not.toThrow()
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
    const release = async (deleteUnusedAfter?: number | string | false) => {
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
    expect(await release('0s')).toEqual(['new', 'old'])
    expect(await release('60 days')).toEqual([])
  })

  it('takes `deleteUnusedAfter` as a duration', async () => {
    await addAsset('old', { since: old })
    await addAsset('new', { since: now })
    const { released } = await createBookAssets('24h').runJobs({
      dryRun: true,
      now
    })
    expect(released.map(asset => asset.key)).toEqual(['old'])
  })

  it('throws for invalid durations and sizes', () => {
    expect(() => createBookAssets('soon')).toThrow(`Invalid duration: 'soon'`)
    expect(() =>
      createAssets({ adapter, paths, storages, maxSize: 'large' })
    ).toThrow(`Invalid file size: 'large'`)
    expect(() =>
      createBookAssets().runJobs({ deleteUnusedAfter: 'later' })
    ).toThrow(`Invalid duration: 'later'`)
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
        return assets.findReferences()
      })
      const references = await response.json()
      expect(references.map((ref: { id: number }) => ref.id)).toEqual([1])
    })
  })
})
