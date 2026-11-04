import fs from 'node:fs/promises'
import type { Kysely } from 'kysely'
import {
  asArray,
  camelize,
  isObject,
  normalizeDataPath,
  parseDataPath
} from '@ditojs/utils'
import {
  HttpError,
  bodyValidation,
  createValidationError,
  type DitoContext,
  type MixinDefinition
} from '@ditojs/server'
import {
  resolveFileUrl,
  type AssetFileObject,
  type Storage
} from './Storage.ts'
import {
  findAssetFiles,
  findInvalidFiles,
  type AssetPath
} from './asset-path.ts'
import { insertAsset } from './assets.ts'
import type { StorageRegistry } from './registry.ts'

// Handles the files in the JSON body of a controller's writes, at the asset
// paths of its table. A file is accepted when the `asset` table holds its key
// in the storage of its path, and it then gets the properties of the stored
// file. Files of other storages are copied, and files without an `asset` row
// are imported from their `url` when the storage allows it. The mixin changes
// the files of the body in place, so handlers read the stored files. Other
// values at these paths respond with 400.

// Returns the Kysely of the request, such as one on `c.var.db`, so that the
// `asset` rows of a write commit with its transaction.
export type AssetDb = (c: DitoContext) => Kysely<any>

// The options of `assets()`, `assetUploads()` and, with a plain Kysely as
// `db`, `importAssets()`.
export interface AssetOptions<Db = AssetDb> {
  table: string
  paths: AssetPath[]
  storages: StorageRegistry
  db: Db
}

// A file object and the storage of its asset path.
interface StorageFile {
  file: AssetFileObject
  storage: Storage
}

interface ImportOptions {
  storages: StorageRegistry
  // Collects the stored files, even of imports that fail later.
  imported?: StorageFile[]
  skipDisallowed?: boolean
}

const writeMethods = ['POST', 'PUT', 'PATCH']

// How long an import from a `url` may take.
const fetchTimeout = 30_000

export function assets({
  table,
  paths,
  storages,
  db
}: AssetOptions): MixinDefinition {
  const tablePaths = paths.filter(path => path.table === table)
  return {
    middleware: async (c, next) => {
      if (!writeMethods.includes(c.req.method)) return next()
      checkFiles(c.var.body, tablePaths)
      const files = findFiles(c.var.body, tablePaths, storages)
      if (files.length === 0) return next()
      const database = db(c)
      const imported: StorageFile[] = []
      // The transaction rolls the rows back, but not the files.
      const removeImported = () =>
        Promise.allSettled(
          imported.map(({ file, storage }) => storage.removeFile(file))
        )
      try {
        // Throws a 400 for files that it can't accept.
        const unreferenced = await importFiles(database, files, {
          storages,
          imported
        })
        // A file in a body is used again, so a release must skip it.
        const keys = [...unreferenced, ...imported.map(({ file }) => file.key)]
        if (keys.length > 0) {
          await database
            .updateTable('asset')
            .set({ unreferenced_since: null })
            .where('key', 'in', keys)
            .execute()
        }
      } catch (error) {
        await removeImported()
        throw error
      }
      await next()
      // Hono handles the errors of later handlers and sets `c.error`.
      if (c.error) await removeImported()
    }
  }
}

// Throws a 400 for values at the asset paths that aren't file objects, which
// `findFiles()` leaves out and the write would store as they are.
function checkFiles(body: unknown, paths: AssetPath[]) {
  const issues = asArray(body).flatMap(item =>
    isObject(item)
      ? paths.flatMap(({ column, path }) => {
          const property = camelize(column)
          return findInvalidFiles(item[property], path).map(filePath => ({
            path: [
              property,
              ...parseDataPath(normalizeDataPath(filePath))
            ],
            message: 'Invalid input: expected a stored file'
          }))
        })
      : []
  )
  if (issues.length > 0) throw createValidationError(issues, bodyValidation)
}

function findFiles(
  body: unknown,
  paths: AssetPath[],
  storages: StorageRegistry
): StorageFile[] {
  return asArray(body).flatMap(item =>
    isObject(item)
      ? paths.flatMap(({ column, path, storage }) =>
          findAssetFiles(item[camelize(column)], path).map(({ file }) => ({
            file,
            storage: storages.get(storage)
          }))
        )
      : []
  )
}

// Gives the files the properties of their stored files. Files that the `asset`
// table holds in their storage keep their key, and others go through
// `importFile()`. Returns the keys of the rows that the files use and that a
// scan found unreferenced. The rows are locked after the imports, so that a
// slow source holds no locks.
async function importFiles(
  db: Kysely<any>,
  files: StorageFile[],
  options: ImportOptions
): Promise<string[]> {
  const keys = [...new Set(files.map(({ file }) => file.key))]
  if (keys.length === 0) return []
  const assets = await db
    .selectFrom('asset')
    .select(['key', 'storage', 'file'])
    .where('key', 'in', keys)
    .execute()
  const assetsByKey = new Map(assets.map(asset => [asset.key, asset]))
  const groups = Map.groupBy(
    files,
    ({ file, storage }) => `${storage.name}:${file.key}`
  )
  // Wait for all imports before throwing, so that the caller removes every
  // imported file.
  const results = await Promise.allSettled(
    [...groups.values()].map(async group => {
      const [first] = group
      const asset = assetsByKey.get(first.file.key)
      const stored =
        asset?.storage === first.storage.name
          ? asset.file
          : await importFile(db, first, asset, options)
      if (!stored) return
      for (const { file } of group) {
        for (const key of Object.keys(file)) {
          delete file[key as keyof AssetFileObject]
        }
        Object.assign(file, stored)
      }
    })
  )
  const rejected = results.find(result => result.status === 'rejected')
  if (rejected) throw rejected.reason
  const used = assets.filter(({ key, storage }) =>
    groups.has(`${storage}:${key}`)
  )
  if (used.length === 0) return []
  const locked = await db
    .selectFrom('asset')
    .select(['key', 'unreferenced_since'])
    .where(
      'key',
      'in',
      used.map(({ key }) => key)
    )
    // A release that runs now would delete rows that this write references.
    // The order keeps two writes from locking each other out.
    .orderBy('key')
    .forUpdate()
    .execute()
  if (locked.length < used.length) {
    throw new HttpError(400, {
      message: 'A file of the request was released in the meantime.'
    })
  }
  return locked
    .filter(({ unreferenced_since: since }) => since)
    .map(({ key }) => key)
}

// Stores a file under a new key and inserts its `asset` row: `asset` is the
// row of a file in another storage, and files without one are fetched from
// their `url` if the storage allows it. Other files throw, or are skipped with
// `skipDisallowed`.
async function importFile(
  db: Kysely<any>,
  { file, storage }: StorageFile,
  asset: { storage: string; file: AssetFileObject } | undefined,
  { storages, imported, skipDisallowed }: ImportOptions
) {
  if (!asset && !storage.isImportSourceAllowed(file.url)) {
    if (skipDisallowed) return null
    throw new HttpError(400, {
      message: `Unable to import asset from foreign source: '${
        file.name ?? file.key
      }' ('${file.url ?? file.key}')`
    })
  }
  const source = asset?.file ?? file
  const data = asset
    ? await storages.get(asset.storage).readFile(source)
    : await fetchFile(file.url!)
  const { name, type, width, height } = source
  const stored = await storage.store({ name: name ?? source.key, type, data })
  // Keep the dimensions that `store()` can't read.
  if (stored.width == null && (width != null || height != null)) {
    Object.assign(stored, { width, height })
  }
  imported?.push({ file: stored, storage })
  await insertAsset(db, stored, storage)
  return stored
}

// Imports the files that `data`, the values of a row of `table`, references
// but that no `asset` row holds in their storage, such as the `file://` files
// of seed data. Files from sources that the storage doesn't allow are skipped.
// Requests do this through `assets()`. Seeds that insert rows call this first.
export async function importAssets<T extends object>(
  data: T,
  { table, paths, storages, db }: AssetOptions<Kysely<any>>
) {
  const tablePaths = paths.filter(path => path.table === table)
  const files = findFiles(data, tablePaths, storages)
  await importFiles(db, files, { storages, skipDisallowed: true })
  return data
}

async function fetchFile(url: string) {
  if (url.startsWith('file://')) {
    return fs.readFile(new URL(resolveFileUrl(url)))
  }
  const importError = (reason: unknown) =>
    new HttpError(400, {
      message: `Unable to import asset from '${url}': ${reason}`
    })
  try {
    const response = await fetch(url, {
      // A redirect could lead to a url that `allowedImports` doesn't match.
      redirect: 'manual',
      signal: AbortSignal.timeout(fetchTimeout)
    })
    if (!response.ok) throw importError(response.status)
    return Buffer.from(await response.arrayBuffer())
  } catch (error) {
    throw error instanceof HttpError
      ? error
      : importError((error as Error).message)
  }
}
