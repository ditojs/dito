import { sql, type Kysely } from 'kysely'
import parseDuration from 'parse-duration'
import { asArray, isNumber, isString } from '@ditojs/utils'
import type { AssetFileObject } from './asset-file.ts'
import type { Storage } from './storage.ts'
import {
  findAssetFiles,
  parseJsonValue,
  type AssetPath
} from './asset-path.ts'

// Tracks stored files in Dito 6's `asset` table by scanning the data at the
// asset paths, through Kysely, so it works with any ORM. `count` is the number
// of rows that reference a file, and `unreferenced_since` the time a scan
// first found it unreferenced. A file that a row holds twice counts once.
// Dates are written as ISO strings, which Postgres casts and SQLite compares
// as text.

export interface AssetChange {
  key: string
  storage: string
  from: number
  to: number
}

export interface UnreferencedAsset {
  key: string
  storage: string
  since: Date
}

export interface ScanAssetsReport {
  changed: AssetChange[]
  unreferenced: UnreferencedAsset[]
  // Keys that rows reference without an `asset` row.
  missing: { key: string; storage: string }[]
  // The number of rows read.
  rows: number
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
  const counts = new Map<string, { count: number; storage: string }>()
  let rows = 0
  for (const [table, tablePaths] of groupByTable(paths)) {
    for await (const row of readRows(db, table, tablePaths)) {
      rows++
      const keys = new Map<string, string>()
      for (const { file, storage } of findRowFiles(row, tablePaths)) {
        if (!keys.has(file.key)) keys.set(file.key, storage)
      }
      for (const [key, storage] of keys) {
        const entry = counts.get(key)
        if (entry) entry.count++
        else counts.set(key, { count: 1, storage })
      }
    }
  }

  const assets = await db
    .selectFrom('asset')
    .select(['key', 'storage', 'count', 'unreferenced_since'])
    .execute()
  const timestamp = now.toISOString()
  const changed: AssetChange[] = []
  const unreferenced: UnreferencedAsset[] = []
  const setUnreferenced: string[] = []
  const clearUnreferenced: string[] = []
  for (const asset of assets) {
    const count = counts.get(asset.key)?.count ?? 0
    if (count !== asset.count) {
      changed.push({
        key: asset.key,
        storage: asset.storage,
        from: asset.count,
        to: count
      })
    }
    if (count === 0) {
      if (asset.unreferenced_since == null) setUnreferenced.push(asset.key)
      unreferenced.push({
        key: asset.key,
        storage: asset.storage,
        since: new Date(asset.unreferenced_since ?? timestamp)
      })
    } else if (asset.unreferenced_since != null) {
      clearUnreferenced.push(asset.key)
    }
  }
  const known = new Set(assets.map(asset => asset.key))
  const missing = [...counts]
    .filter(([key]) => !known.has(key))
    .map(([key, { storage }]) => ({ key, storage }))

  if (!dryRun) {
    await db.transaction().execute(async trx => {
      // One update per new count, instead of one per asset.
      const keysByCount = Map.groupBy(changed, change => change.to)
      for (const [count, changes] of keysByCount) {
        await updateAssets(
          trx,
          changes.map(change => change.key),
          {
            count,
            updated_at: timestamp
          }
        )
      }
      await updateAssets(trx, setUnreferenced, {
        unreferenced_since: timestamp
      })
      await updateAssets(trx, clearUnreferenced, { unreferenced_since: null })
    })
  }

  return {
    changed,
    unreferenced,
    missing,
    rows,
    duration: Math.round(performance.now() - start)
  }
}

export interface ReleaseAssetsOptions {
  db: Kysely<any>
  // The storages by name.
  storages: Record<string, Storage>
  // How long an asset stays unreferenced before it is released, in
  // milliseconds or as a string such as `'12h'`.
  after: number | string
  now?: Date
  // Only reports the assets, and deletes nothing.
  dryRun?: boolean
}

export interface ReleasedAsset {
  key: string
  storage: string
  // Set when the file couldn't be removed. The row is deleted anyway.
  error?: unknown
}

// Deletes the files and `asset` rows of the assets that the scans found
// unreferenced for longer than `after`. A scan needs to run in between, so
// that files which rows reference again aren't released.
export async function releaseAssets({
  db,
  storages,
  after,
  now = new Date(),
  dryRun = false
}: ReleaseAssetsOptions): Promise<ReleasedAsset[]> {
  const before = new Date(now.getTime() - getDuration(after)).toISOString()
  const select = (db: Kysely<any>) =>
    db
      .selectFrom('asset')
      .select(['key', 'storage', 'file'])
      .where('count', '=', 0)
      .where('unreferenced_since', '<=', before)
  if (dryRun) {
    const assets = await select(db).execute()
    return assets.map(({ key, storage }) => ({ key, storage }))
  }
  const assets = await db.transaction().execute(async trx => {
    const keys = (await select(trx).execute()).map(asset => asset.key)
    const deleted = []
    for (const chunk of chunkArray(keys)) {
      // Repeat the conditions, for writes since the select.
      deleted.push(
        ...(await trx
          .deleteFrom('asset')
          .where('key', 'in', chunk)
          .where('count', '=', 0)
          .where('unreferenced_since', '<=', before)
          .returning(['key', 'storage', 'file'])
          .execute())
      )
    }
    return deleted
  })
  // Remove the files after the commit, so that a failed transaction keeps
  // them. Files left over by failed removals are found by `findStrayFiles()`.
  const released: ReleasedAsset[] = []
  for (const { key, storage: name, file } of assets) {
    const result: ReleasedAsset = { key, storage: name }
    try {
      const storage = storages[name]
      if (!storage) throw new Error(`Unknown storage '${name}'`)
      await storage.removeFile(parseJsonValue(file) ?? { key })
    } catch (error) {
      // ENOENT means that the file is already gone.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        result.error = error
      }
    }
    released.push(result)
  }
  return released
}

// Lists the keys of the files in a storage that have no `asset` row.
export async function findStrayFiles({
  db,
  storage
}: {
  db: Kysely<any>
  storage: Storage
}) {
  const assets = await db
    .selectFrom('asset')
    .select('key')
    .where('storage', '=', storage.name)
    .execute()
  const known = new Set(assets.map(asset => asset.key))
  return (await storage.listKeys()).filter(key => !known.has(key)).sort()
}

export interface AssetUsage {
  table: string
  id: unknown
  column: string
}

// Lists the rows that reference `key`, in each column once.
export async function findAssetUsage({
  db,
  paths,
  key
}: {
  db: Kysely<any>
  paths: AssetPath[]
  key: string
}) {
  const usage: AssetUsage[] = []
  // Keys appear in JSON as JSON strings.
  const pattern = `%${escapeLike(JSON.stringify(key).slice(1, -1))}%`
  for (const [table, tablePaths] of groupByTable(paths)) {
    const columns = [...new Set(tablePaths.map(path => path.column))]
    // Find the rows that hold the key in their JSON text, and match the
    // files exactly below.
    const where = (eb: any) =>
      eb.or(
        columns.map(
          column =>
            sql<boolean>`cast(${sql.ref(column)} as text) like ${
              pattern
            } escape '!'`
        )
      )
    for await (const row of readRows(db, table, tablePaths, where)) {
      const found = new Set<string>()
      for (const { file, column } of findRowFiles(row, tablePaths)) {
        if (file.key === key && !found.has(column)) {
          found.add(column)
          usage.push({ table, id: row.id, column })
        }
      }
    }
  }
  return usage
}

// Inserts the `asset` rows of new uploads, unreferenced until a scan finds
// them, such as in `uploadHandler()`'s `onUpload`.
export async function insertAsset(
  db: Kysely<any>,
  files: AssetFileObject | AssetFileObject[],
  storage: Storage | string
) {
  const now = new Date().toISOString()
  const rows = asArray(files).map(({ signature: _, ...file }) => ({
    key: file.key,
    file: JSON.stringify(file),
    storage: isString(storage) ? storage : storage.name,
    count: 0,
    unreferenced_since: now,
    created_at: now,
    updated_at: now
  }))
  if (rows.length > 0) {
    await db.insertInto('asset').values(rows).execute()
  }
}

export function getDuration(duration: number | string) {
  const ms = isNumber(duration) ? duration : parseDuration(duration)
  if (!isNumber(ms) || !(ms >= 0)) {
    throw new Error(`Invalid duration: ${JSON.stringify(duration)}`)
  }
  return ms
}

function groupByTable(paths: AssetPath[]) {
  return Map.groupBy(paths, path => path.table)
}

function* findRowFiles(row: Record<string, unknown>, paths: AssetPath[]) {
  for (const { column, path, storage } of paths) {
    for (const { file } of findAssetFiles(parseJsonValue(row[column]), path)) {
      yield { file, column, storage }
    }
  }
}

// Reads the asset columns of a table in pages by `id`, to keep memory low on
// large tables.
async function* readRows(
  db: Kysely<any>,
  table: string,
  paths: AssetPath[],
  where?: (eb: any) => any,
  pageSize = 10_000
) {
  const columns = [...new Set(paths.map(path => path.column))]
  let lastId: unknown = null
  while (true) {
    let query = db
      .selectFrom(table)
      .select(['id', ...columns.filter(column => column !== 'id')])
      .orderBy('id')
      .limit(pageSize)
    if (where) query = query.where(where)
    if (lastId !== null) query = query.where('id', '>', lastId)
    const rows = await query.execute()
    yield* rows
    if (rows.length < pageSize) break
    lastId = rows.at(-1)!.id
  }
}

async function updateAssets(
  db: Kysely<any>,
  keys: string[],
  values: Record<string, unknown>
) {
  for (const chunk of chunkArray(keys)) {
    await db
      .updateTable('asset')
      .set(values)
      .where('key', 'in', chunk)
      .execute()
  }
}

// Keeps `in` lists below the parameter limits of the databases.
function chunkArray<T>(array: T[], size = 1000) {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

function escapeLike(string: string) {
  return string.replace(/[!%_]/g, '!$&')
}
