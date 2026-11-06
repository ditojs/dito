import {
  findAssetReferences,
  releaseAssets,
  runAssetJobs,
  scanAssets
} from './assetJobs.ts'
import {
  setupAssetTests,
  db,
  covers,
  storages,
  paths,
  file,
  addBook,
  addAsset,
  getAssets,
  getKeys,
  old,
  now
} from './test/assets.ts'

setupAssetTests()

describe('scanAssets()', () => {
  beforeEach(async () => {
    await addBook(1, {
      cover: file('a'),
      pages: [{ images: [file('a'), file('b')] }]
    })
    await addBook(2, { notes: { items: [{ file: file('c') }] } })
    await addAsset('a', { since: old })
    await addAsset('b')
    await addAsset('d')
    await addAsset('e', { since: old })
  })

  it('sets `unreferenced_since` and inserts missing rows', async () => {
    const report = await scanAssets({ database: db, paths, now })
    expect(report).toMatchObject({
      referenced: [{ key: 'a', storage: 'covers' }],
      unreferenced: [
        { key: 'd', storage: 'covers', since: now },
        { key: 'e', storage: 'covers', since: old }
      ],
      missing: [{ key: 'c', storage: 'covers' }],
      rowCount: 2
    })
    expect(await getAssets()).toEqual([
      { key: 'a', unreferenced_since: null },
      { key: 'b', unreferenced_since: null },
      { key: 'c', unreferenced_since: null },
      { key: 'd', unreferenced_since: now },
      { key: 'e', unreferenced_since: old }
    ])
    const missing = await db
      .selectFrom('asset')
      .select(['file', 'storage'])
      .where('key', '=', 'c')
      .executeTakeFirst()
    expect(missing).toEqual({ file: file('c'), storage: 'covers' })
  })

  it('inserts no rows for keys that address other files', async () => {
    await addBook(3, { cover: file('3f/../victim') })
    const report = await scanAssets({ database: db, paths, now })
    expect(report.missing).toEqual([{ key: 'c', storage: 'covers' }])
    expect(await getKeys()).not.toContain('3f/../victim')
  })

  it('runs in the transaction that it gets', async () => {
    await db.transaction().execute(async trx => {
      const report = await scanAssets({ database: trx, paths })
      expect(report.missing).toHaveLength(1)
    })
    expect(await getKeys()).toContain('c')
  })

  it('writes nothing in a dry run', async () => {
    const before = await getAssets()
    const report = await scanAssets({ database: db, paths, dryRun: true, now })
    expect(report.referenced).toHaveLength(1)
    expect(report.missing).toHaveLength(1)
    expect(await getAssets()).toEqual(before)
  })
})

describe('releaseAssets()', () => {
  it('releases assets unreferenced since `before`', async () => {
    for (const key of ['old', 'new', 'used']) {
      await covers.addFile(file(key), Buffer.from(key))
    }
    await addAsset('old', { since: new Date('2026-10-29T23:00:00Z') })
    await addAsset('new', { since: new Date('2026-10-30T01:00:00Z') })
    await addAsset('used')
    await addAsset('gone', { since: old })
    // A file that is already gone is released without an error.
    const released = await releaseAssets({
      database: db,
      storages,
      before: new Date('2026-10-30T00:00:00Z')
    })
    expect(released.sort((a, b) => a.key.localeCompare(b.key))).toEqual([
      { key: 'gone', storage: 'covers' },
      { key: 'old', storage: 'covers' }
    ])
    expect(await getKeys()).toEqual(['new', 'used'])
    expect((await covers.listKeys()).sort()).toEqual(['new', 'used'])
  })
})

describe('runAssetJobs()', () => {
  beforeEach(async () => {
    await covers.addFile(file('old'), Buffer.from('old'))
    await addBook(1, { cover: file('used') })
    await addAsset('used', { since: old })
    await addAsset('old', { since: old })
    await addAsset('new')
  })

  const options = () => ({
    database: db,
    paths,
    storages,
    deleteUnusedAfter: 24 * 60 * 60 * 1000,
    now
  })

  it('scans, then releases the unused assets', async () => {
    const { scan, released } = await runAssetJobs(options())
    expect(scan.referenced).toEqual([{ key: 'used', storage: 'covers' }])
    expect(released).toEqual([{ key: 'old', storage: 'covers' }])
    expect(await getKeys()).toEqual(['new', 'used'])
    expect(await covers.listKeys()).toEqual([])
  })

  it('skips the release with `deleteUnusedAfter: false`', async () => {
    const { released } = await runAssetJobs({
      ...options(),
      deleteUnusedAfter: false
    })
    expect(released).toEqual([])
    expect(await getKeys()).toEqual(['new', 'old', 'used'])
  })

  it('returns the assets of the release in a dry run', async () => {
    const before = await getAssets()
    const { released } = await runAssetJobs({ ...options(), dryRun: true })
    expect(released).toEqual([{ key: 'old', storage: 'covers' }])
    expect(await getAssets()).toEqual(before)
    expect(await covers.listKeys()).toEqual(['old'])
  })
})

describe('findAssetReferences()', () => {
  beforeEach(async () => {
    await addBook(1, {
      cover: file('a'),
      pages: [{ images: [file('a'), file('b')] }]
    })
    await addBook(2, { notes: { items: [{ file: file('b') }] } })
  })

  it('lists the files at the asset paths with their locations', async () => {
    const references = await findAssetReferences({ database: db, paths })
    expect(
      references.map(({ key, id, column, dataPath, storage }) => ({
        key,
        id,
        column,
        dataPath,
        storage
      }))
    ).toEqual([
      {
        key: 'a',
        id: 1,
        column: 'cover',
        dataPath: 'cover',
        storage: 'covers'
      },
      {
        key: 'a',
        id: 1,
        column: 'pages',
        dataPath: 'pages/0/images/0',
        storage: 'covers'
      },
      {
        key: 'b',
        id: 1,
        column: 'pages',
        dataPath: 'pages/0/images/1',
        storage: 'covers'
      },
      {
        key: 'b',
        id: 2,
        column: 'notes',
        dataPath: 'notes/items/0/file',
        storage: 'covers'
      }
    ])
    expect(references[0]).toMatchObject({
      table: 'book',
      file: file('a'),
      assetPath: paths[0]
    })
  })

  it('filters by keys, storage and tables', async () => {
    expect(
      (await findAssetReferences({ database: db, paths, keys: ['b'] })).map(
        reference => reference.dataPath
      )
    ).toEqual(['pages/0/images/1', 'notes/items/0/file'])
    expect(
      await findAssetReferences({ database: db, paths, storage: 'archive' })
    ).toEqual(
      []
    )
    expect(
      await findAssetReferences({ database: db, paths, tables: ['other'] })
    ).toEqual(
      []
    )
  })

  it('assigns each location to the first path that reaches it', async () => {
    const overlapping = [...paths, { ...paths[1], storage: 'archive' }]
    const references = await findAssetReferences({
      database: db,
      paths: overlapping
    })
    expect(references).toHaveLength(4)
    expect(references.every(({ storage }) => storage === 'covers')).toBe(true)
  })
})
