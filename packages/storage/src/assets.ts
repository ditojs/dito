import type { Kysely } from 'kysely'
import { mapConcurrently } from '@ditojs/utils'
import type { AssetFile, Storage, StoreOptions } from './Storage.ts'
import {
  findAssetFiles,
  getDataPath,
  type AssetPath
} from './asset-path.ts'
import type { StorageRegistry } from './registry.ts'

// Tracks stored files in the `asset` table by scanning the data at the asset
// paths, through Kysely. Each row holds the `key`, `file` and `storage` of a
// stored file, and `unreferenced_since`, the time a scan first found no data
// that references the file, or null. The scan inserts the rows of referenced
// files that have none, since writes accept only files with a row.

export interface AssetKey {
  key: string
  storage: string
}

export interface UnreferencedAsset extends AssetKey {
  since: Date
}

export interface ScanAssetsReport {
  // The rows that data references again. The scan clears their
  // `unreferenced_since`.
  referenced: AssetKey[]
  // The rows that no data references, with their `unreferenced_since`. The
  // rows that the scan finds unreferenced first get `now`.
  unreferenced: UnreferencedAsset[]
  // The keys that data references without an `asset` row. The scan inserts
  // their rows.
  missing: AssetKey[]
  // The number of rows read.
  rowCount: number
  // In milliseconds.
  duration: number
}

export interface ScanAssetsOptions {
  db: Kysely<any>
  paths: AssetPath[]
  // Only reports the changes, and writes nothing.
  dryRun?: boolean
  now?: Date
}

export async function scanAssets({
  db,
  paths,
  dryRun = false,
  now = new Date()
}: ScanAssetsOptions): Promise<ScanAssetsReport> {
  const start = performance.now()
  const references = new Map<string, AssetReference>()
  let rowCount = 0
  for await (const rowReferences of readReferences(db, paths)) {
    rowCount++
    for (const reference of rowReferences) {
      if (!references.has(reference.key)) {
        references.set(reference.key, reference)
      }
    }
  }

  const assets = await db
    .selectFrom('asset')
    .select(['key', 'storage', 'unreferenced_since'])
    .orderBy('key')
    .execute()
  const referenced: AssetKey[] = []
  const unreferenced: UnreferencedAsset[] = []
  for (const { key, storage, unreferenced_since: since } of assets) {
    if (references.has(key)) {
      if (since) referenced.push({ key, storage })
    } else {
      // Some drivers, such as MikroORM's, return dates as strings.
      unreferenced.push({ key, storage, since: since ? new Date(since) : now })
    }
  }
  const known = new Set(assets.map(asset => asset.key))
  const missing = [...references.values()].filter(({ key }) => !known.has(key))

  if (!dryRun) {
    await inTransaction(db, async trx => {
      await updateAssets(trx, referenced, null, now)
      await updateAssets(
        trx,
        unreferenced.filter(asset => asset.since === now),
        now,
        now
      )
      for (const chunk of chunkArray(missing)) {
        await trx
          .insertInto('asset')
          .values(
            chunk.map(({ key, storage, file }) => ({
              key,
              file,
              storage,
              unreferenced_since: null,
              created_at: now,
              updated_at: now
            }))
          )
          .execute()
      }
    })
  }

  return {
    referenced,
    unreferenced,
    missing: missing.map(({ key, storage }) => ({ key, storage })),
    rowCount,
    duration: Math.round(performance.now() - start)
  }
}

export interface ReleaseAssetsOptions {
  db: Kysely<any>
  storages: StorageRegistry
  // How long an asset stays unreferenced before it is released, in
  // milliseconds.
  deleteUnusedAfter: number
  now?: Date
}

export interface ReleasedAsset extends AssetKey {
  // Set when the file couldn't be removed. The row is deleted anyway.
  error?: unknown
}

// Deletes the files and `asset` rows of the assets that the scans found
// unreferenced for longer than `deleteUnusedAfter`. A scan needs to run in
// between, so that files which rows reference again aren't released.
export async function releaseAssets({
  db,
  storages,
  deleteUnusedAfter,
  now = new Date()
}: ReleaseAssetsOptions): Promise<ReleasedAsset[]> {
  const assets = await db
    .deleteFrom('asset')
    .where(
      'unreferenced_since',
      '<=',
      new Date(now.getTime() - deleteUnusedAfter)
    )
    .returning(['key', 'storage', 'file'])
    .execute()
  // Remove the files after the delete, so that a failed delete keeps them.
  return mapConcurrently(
    assets,
    async ({ key, storage, file }) => {
      const result: ReleasedAsset = { key, storage }
      try {
        await storages.get(storage).removeFile(file ?? { key })
      } catch (error) {
        // ENOENT means that the file is already gone.
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          result.error = error
        }
      }
      return result
    },
    { concurrency: 16 }
  )
}

// Inserts the `asset` row of a new file, unreferenced until a scan finds it.
// If `db` is outside the transaction of the write that references the file
// and that write rolls back, the release deletes the file later.
export async function insertAsset(
  db: Kysely<any>,
  file: AssetFile,
  storage: Storage
) {
  const now = new Date()
  await db
    .insertInto('asset')
    .values({
      key: file.key,
      file,
      storage: storage.name,
      unreferenced_since: now,
      created_at: now,
      updated_at: now
    })
    .execute()
}

// Stores a file and inserts its `asset` row, so that the jobs track it, such
// as a PDF that the server creates. When the insert fails, it removes the
// file again.
export async function storeAsset(
  db: Kysely<any>,
  storage: Storage,
  options: StoreOptions
) {
  const file = await storage.store(options)
  try {
    await insertAsset(db, file, storage)
  } catch (error) {
    await storage.removeFile(file).catch(() => {})
    throw error
  }
  return file
}

export interface RunAssetJobsOptions {
  db: Kysely<any>
  paths: AssetPath[]
  storages: StorageRegistry
  // The `deleteUnusedAfter` of `releaseAssets()`. With `false`, the release is
  // skipped.
  deleteUnusedAfter: number | false
  // Writes and deletes nothing, and returns the assets that the release
  // would delete as `released`.
  dryRun?: boolean
  now?: Date
}

// Runs the scan and then the release, so that the release keeps the files
// that rows reference again. The app logs the report and the errors of the
// released assets.
export async function runAssetJobs({
  db,
  paths,
  storages,
  deleteUnusedAfter,
  dryRun = false,
  now = new Date()
}: RunAssetJobsOptions) {
  const scan = await scanAssets({ db, paths, dryRun, now })
  let released: ReleasedAsset[] = []
  if (deleteUnusedAfter !== false) {
    const before = now.getTime() - deleteUnusedAfter
    released = dryRun
      ? scan.unreferenced
          .filter(({ since }) => since.getTime() <= before)
          .map(({ key, storage }) => ({ key, storage }))
      : await releaseAssets({ db, storages, deleteUnusedAfter, now })
  }
  return { scan, released }
}

export interface AssetReference {
  key: string
  file: AssetFile
  table: string
  id: unknown
  column: string
  // The data path of the file in the row, with the column as its camelCase
  // property, such as `pages/0/images/1`.
  dataPath: string
  storage: string
  // The asset path that reaches the file.
  assetPath: AssetPath
}

export interface FindAssetReferencesOptions {
  db: Kysely<any>
  paths: AssetPath[]
  // Only these tables, when set.
  tables?: string[]
  // Only files of this storage, when set.
  storage?: string
  // Only these keys, when set.
  keys?: string[]
}

// Lists the files that the rows reference at the asset paths. Each location in
// a row belongs to the first asset path that reaches it.
export async function findAssetReferences({
  db,
  paths,
  tables,
  storage,
  keys
}: FindAssetReferencesOptions) {
  const keySet = keys && new Set(keys)
  const references: AssetReference[] = []
  const selected = tables
    ? paths.filter(path => tables.includes(path.table))
    : paths
  for await (const rowReferences of readReferences(db, selected)) {
    references.push(
      ...rowReferences.filter(
        reference => (
          (!storage || reference.storage === storage) &&
          (!keySet || keySet.has(reference.key))
        )
      )
    )
  }
  return references
}

// Yields the references of each row of the tables of `paths`, including the
// empty ones of rows without files.
async function* readReferences(db: Kysely<any>, paths: AssetPath[]) {
  const pathsByTable = Map.groupBy(paths, path => path.table)
  for (const [table, tablePaths] of pathsByTable) {
    for await (const row of readRows(db, table, tablePaths)) {
      yield getRowReferences(row, table, tablePaths)
    }
  }
}

function getRowReferences(
  row: Record<string, unknown>,
  table: string,
  paths: AssetPath[]
) {
  const references = new Map<string, AssetReference>()
  for (const assetPath of paths) {
    const { column, path, storage } = assetPath
    for (const { file, path: filePath } of findAssetFiles(row[column], path)) {
      const dataPath = getDataPath(column, filePath)
      if (!references.has(dataPath)) {
        references.set(dataPath, {
          key: file.key,
          file,
          table,
          id: row.id,
          column,
          dataPath,
          storage,
          assetPath
        })
      }
    }
  }
  return [...references.values()]
}

const pageSize = 10_000

// Reads the asset columns of a table in pages by `id`, to keep memory low on
// large tables.
async function* readRows(db: Kysely<any>, table: string, paths: AssetPath[]) {
  const columns = [...new Set(paths.map(path => path.column))]
  let lastId: unknown = null
  while (true) {
    let query = db
      .selectFrom(table)
      .select(['id', ...columns.filter(column => column !== 'id')])
      .orderBy('id')
      .limit(pageSize)
    if (lastId !== null) query = query.where('id', '>', lastId)
    const rows = await query.execute()
    yield* rows
    if (rows.length < pageSize) break
    lastId = rows.at(-1)!.id
  }
}

async function updateAssets(
  db: Kysely<any>,
  assets: AssetKey[],
  since: Date | null,
  now: Date
) {
  for (const chunk of chunkArray(assets.map(asset => asset.key))) {
    await db
      .updateTable('asset')
      .set({ unreferenced_since: since, updated_at: now })
      .where('key', 'in', chunk)
      .execute()
  }
}

// Runs `fn` in a transaction, or in the transaction that `db` already is.
function inTransaction<T>(
  db: Kysely<any>,
  fn: (trx: Kysely<any>) => Promise<T>
) {
  return db.isTransaction ? fn(db) : db.transaction().execute(fn)
}

// Keeps `in` lists and inserts below the parameter limit of Postgres.
function chunkArray<T>(array: T[], size = 1000) {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
