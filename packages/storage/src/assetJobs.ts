import type { Kysely } from 'kysely'
import { mapConcurrently } from '@ditojs/utils'
import type { AssetFile } from './Storage.ts'
import {
  findAssetFiles,
  getDataPath,
  type AssetPath
} from './assetPaths.ts'
import type { StorageRegistry } from './StorageRegistry.ts'

export interface Asset {
  key: string
  storage: string
}

export interface UnreferencedAsset extends Asset {
  since: Date
}

export interface ScanAssetsReport {
  // The rows that data references again. The scan clears their
  // `unreferenced_since`.
  referenced: Asset[]
  // The rows that no data references, with their `unreferenced_since`. The
  // rows that the scan finds unreferenced first get `now`.
  unreferenced: UnreferencedAsset[]
  // The keys that data references without an `asset` row. The scan inserts
  // their rows.
  missing: Asset[]
  // The number of rows read.
  rowCount: number
  // In milliseconds.
  duration: number
}

export interface ScanAssetsOptions {
  db: Kysely<any>
  paths: AssetPath[]
  // Report the changes, but write nothing.
  dryRun?: boolean
  now?: Date
}

// Set `unreferenced_since` of the `asset` rows to the time a scan first finds
// no data that references their file, or to null. Insert the rows of
// referenced files that have none, since writes accept only files with a row.
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
  const referenced: Asset[] = []
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
    const write = async (trx: Kysely<any>) => {
      await updateAssets(trx, referenced, null, now)
      await updateAssets(
        trx,
        unreferenced.filter(asset => asset.since === now),
        now,
        now
      )
      for (const batch of getBatches(missing)) {
        await trx
          .insertInto('asset')
          .values(
            batch.map(({ key, storage, file }) => ({
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
    }
    await (db.isTransaction ? write(db) : db.transaction().execute(write))
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
  // Release the assets unreferenced since this time or earlier.
  before: Date
}

export interface ReleasedAsset extends Asset {
  // Set when the file couldn't be removed. The row is deleted anyway.
  error?: unknown
}

// A scan needs to run in between, so that files which rows reference again
// aren't released.
export async function releaseAssets({
  db,
  storages,
  before
}: ReleaseAssetsOptions): Promise<ReleasedAsset[]> {
  const assets = await db
    .deleteFrom('asset')
    .where('unreferenced_since', '<=', before)
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

export interface RunAssetJobsOptions {
  db: Kysely<any>
  paths: AssetPath[]
  storages: StorageRegistry
  // How long an asset stays unreferenced before its release, in milliseconds.
  // With `false`, the release is skipped.
  deleteUnusedAfter: number | false
  // Write and delete nothing, and return the assets that the release would
  // delete as `released`.
  dryRun?: boolean
  now?: Date
}

// Run the scan before the release, so that the release keeps the files that
// rows reference again:
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
    const before = new Date(now.getTime() - deleteUnusedAfter)
    released = dryRun
      ? scan.unreferenced
          .filter(({ since }) => since <= before)
          .map(({ key, storage }) => ({ key, storage }))
      : await releaseAssets({ db, storages, before })
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

// Each location in a row belongs to the first asset path that reaches it.
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

// Yield the references of each row, also the empty ones of rows without files:
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

// Read the rows in pages by `id`, to keep memory low on large tables:
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
  assets: Asset[],
  since: Date | null,
  now: Date
) {
  for (const batch of getBatches(assets.map(asset => asset.key))) {
    await db
      .updateTable('asset')
      .set({ unreferenced_since: since, updated_at: now })
      .where('key', 'in', batch)
      .execute()
  }
}

// Keep `in` lists and inserts below the parameter limit of Postgres:
function getBatches<T>(array: T[], size = 1000) {
  const batches: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    batches.push(array.slice(i, i + size))
  }
  return batches
}
