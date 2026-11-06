import fs from 'node:fs'
import type { Kysely } from 'kysely'
import {
  asArray,
  isObject,
  mapConcurrently,
  normalizeDataPath,
  parseDataPath
} from '@ditojs/utils'
import {
  HttpError,
  createValidationError,
  type DitoContext,
  type MixinDefinition
} from '@ditojs/server'
import { bodyValidation } from '@ditojs/server/internal'
import {
  getChunks,
  resolveFileUrl,
  type AssetFile,
  type FileData,
  type Storage,
  type StoreOptions
} from './Storage.ts'
import {
  findAssetFiles,
  findInvalidFiles,
  type NormalizedAssetPath
} from './assetPaths.ts'
import type { StorageRegistry } from './StorageRegistry.ts'

// Use the Kysely of the request, such as one on `c.var.em`, so that the
// `asset` rows of a write commit with its transaction:
export type AssetDb = (c: DitoContext) => Kysely<any>

interface AssetOptions {
  paths: NormalizedAssetPath[]
  storages: StorageRegistry
}

// A file at an asset path, with the storage and the size limit of the path:
interface AssetPathFile {
  file: AssetFile
  storage: Storage
  maxSize?: number
}

interface ImportOptions {
  storages: StorageRegistry
  // Collects the stored files, even of imports that fail later.
  imported?: AssetPathFile[]
  skipDisallowed?: boolean
}

const writeMethods = ['POST', 'PUT', 'PATCH']

// How long an import from a `url` may take.
const fetchTimeout = 30_000

// How many files a write imports at once.
const importConcurrency = 8

// Accept the files in the body that the `asset` table holds in the storage of
// their path, copy files of other storages, and import files without `asset`
// row from their `url` when the storage allows it. Change the files of the
// body in place, so that handlers read the stored files.
export function defineAssetWrites({
  paths,
  storages,
  getDb
}: AssetOptions & { getDb: AssetDb }): MixinDefinition {
  return {
    middleware: async (c, next) => {
      const imported: AssetPathFile[] = []
      // The transaction rolls the rows back, but not the files.
      const removeImported = () =>
        Promise.allSettled(
          imported.map(({ file, storage }) => storage.removeFile(file))
        )
      if (writeMethods.includes(c.req.method)) {
        checkFiles(c.var.body, paths)
        const files = findFiles(c.var.body, paths, storages)
        if (files.length > 0) {
          const db = getDb(c)
          try {
            // Files that can't be accepted throw a 400.
            const unreferenced = await importFiles(db, files, {
              storages,
              imported
            })
            // A file in a body is used again, so a release must skip it.
            const keys = [
              ...unreferenced,
              ...imported.map(({ file }) => file.key)
            ]
            if (keys.length > 0) {
              await db
                .updateTable('asset')
                .set({ unreferenced_since: null })
                .where('key', 'in', keys)
                .execute()
            }
          } catch (error) {
            await removeImported()
            throw error
          }
        }
      }
      await next()
      // Hono handles the errors of later handlers and sets `c.error`.
      if (c.error) await removeImported()
    }
  }
}

// Answer values at the asset paths that aren't files with 400, as `findFiles()`
// leaves them out and the write would store them as they are.
function checkFiles(body: unknown, paths: NormalizedAssetPath[]) {
  const issues = asArray(body).flatMap(item =>
    isObject(item)
      ? paths.flatMap(({ property, path }) =>
          findInvalidFiles(item[property], path).map(filePath => ({
            path: [
              property,
              ...parseDataPath(normalizeDataPath(filePath))
            ],
            message: 'Invalid input: expected a stored file'
          }))
        )
      : []
  )
  if (issues.length > 0) throw createValidationError(issues, bodyValidation)
}

function findFiles(
  body: unknown,
  paths: NormalizedAssetPath[],
  storages: StorageRegistry
): AssetPathFile[] {
  return asArray(body).flatMap(item =>
    isObject(item)
      ? paths.flatMap(({ property, path, storage, maxSize }) =>
          findAssetFiles(item[property], path).map(({ file }) => ({
            file,
            storage: storages.get(storage),
            maxSize
          }))
        )
      : []
  )
}

// Give the files the properties of their stored files, and return the keys of
// the rows that they use and that a scan found unreferenced. Files that the
// `asset` table holds in their storage keep their key.
async function importFiles(
  db: Kysely<any>,
  files: AssetPathFile[],
  options: ImportOptions
): Promise<string[]> {
  const getStorageKey = (storage: string, key: string) => `${storage}:${key}`
  const keys = [...new Set(files.map(({ file }) => file.key))]
  if (keys.length === 0) return []
  const assets = await db
    .selectFrom('asset')
    .select(['key', 'storage', 'file'])
    .where('key', 'in', keys)
    .execute()
  const assetsByKey = new Map(assets.map(asset => [asset.key, asset]))
  const groups = Map.groupBy(files, ({ file, storage }) =>
    getStorageKey(storage.name, file.key)
  )
  // Wait for all imports before throwing, so that the caller removes every
  // imported file.
  const errors: unknown[] = []
  await mapConcurrently(
    [...groups.values()],
    async group => {
      try {
        const [first] = group
        const asset = assetsByKey.get(first.file.key)
        const stored =
          asset?.storage === first.storage.name
            ? asset.file
            : await importFile(db, first, asset, options)
        if (stored) {
          for (const { file } of group) {
            for (const key of Object.keys(file)) {
              delete file[key as keyof AssetFile]
            }
            Object.assign(file, stored)
          }
        }
      } catch (error) {
        errors.push(error)
      }
    },
    { concurrency: importConcurrency }
  )
  if (errors.length > 0) throw errors[0]
  const usedKeys = assets
    .filter(({ key, storage }) => groups.has(getStorageKey(storage, key)))
    .map(({ key }) => key)
  // Lock the rows only after the imports, so that a slow source holds no locks.
  // A release that runs now would delete rows that this write references, and
  // the order keeps two writes from locking each other out.
  const locked =
    usedKeys.length > 0
      ? await db
          .selectFrom('asset')
          .select(['key', 'unreferenced_since'])
          .where('key', 'in', usedKeys)
          .orderBy('key')
          .forUpdate()
          .execute()
      : []
  if (locked.length < usedKeys.length) {
    throw new HttpError(400, {
      message: 'A file of the request was released in the meantime.'
    })
  }
  return locked
    .filter(({ unreferenced_since: since }) => since)
    .map(({ key }) => key)
}

// Copy files with the `asset` row of another storage, and fetch files without
// one from their `url` if the storage allows it:
async function importFile(
  db: Kysely<any>,
  { file, storage, maxSize }: AssetPathFile,
  asset: { storage: string; file: AssetFile } | undefined,
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
    : fetchFile(file.url!)
  const { name, type, width, height } = source
  const stored = await storage.store({
    name: name ?? source.key,
    type,
    data: maxSize != null ? limitSize(data, maxSize) : data
  })
  // Keep the dimensions that `store()` can't read.
  if (stored.width == null && (width != null || height != null)) {
    Object.assign(stored, { width, height })
  }
  imported?.push({ file: stored, storage })
  await insertAsset(db, stored, storage)
  return stored
}

// Seeds that insert rows import the files of their data first, such as
// `file://` files, and skip sources that the storage doesn't allow:
export async function importAssets<T extends object>(
  data: T,
  {
    table,
    paths,
    storages,
    db
  }: AssetOptions & { table: string; db: Kysely<any> }
) {
  const tablePaths = paths.filter(path => path.table === table)
  const files = findFiles(data, tablePaths, storages)
  await importFiles(db, files, { storages, skipDisallowed: true })
  return data
}

async function* fetchFile(url: string) {
  if (url.startsWith('file://')) {
    yield* fs.createReadStream(new URL(resolveFileUrl(url)))
  } else {
    const createImportError = (reason: unknown) =>
      new HttpError(400, {
        message: `Unable to import asset from '${url}': ${reason}`
      })
    try {
      const response = await fetch(url, {
        // A redirect could lead to a url that `allowedImports` doesn't match.
        redirect: 'manual',
        signal: AbortSignal.timeout(fetchTimeout)
      })
      if (!response.ok || !response.body) {
        throw createImportError(response.status)
      }
      yield* response.body
    } catch (error) {
      throw error instanceof HttpError
        ? error
        : createImportError((error as Error).message)
    }
  }
}

// Fail with 413 as soon as the data grows over `maxSize`:
async function* limitSize(data: FileData, maxSize: number) {
  let size = 0
  for await (const chunk of getChunks(data)) {
    size += chunk.byteLength
    if (size > maxSize) throw new HttpError(413)
    yield chunk
  }
}

// The row stays unreferenced until a scan finds the file. If `db` is outside
// the transaction of the write that references the file and that write rolls
// back, the release deletes the file later.
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

// Insert the `asset` row of files that the server creates, such as PDFs, so
// that the jobs track them:
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
