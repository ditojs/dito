import fs from 'node:fs'
import type { Kysely } from 'kysely'
import type { EntityMetadata } from '@mikro-orm/core'
import {
  asArray,
  isArray,
  isObject,
  mapConcurrently,
  normalizeDataPath,
  parseDataPath
} from '@ditojs/utils'
import {
  HttpError,
  createValidationError,
  type Adapter,
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
  type NormalizedAssetField
} from './assetFields.ts'
import type { StorageRegistry } from './StorageRegistry.ts'

// A row of a body, at `path`, with the fields of its entity:
interface AssetRow {
  row: Record<string, any>
  fields: NormalizedAssetField[]
  path: (string | number)[]
}

interface DefineAssetWritesOptions extends Pick<Adapter, 'getKysely'> {
  // The entity of the wrapped model controllers.
  meta: Pick<EntityMetadata, 'class' | 'relations'>
  fieldsByEntity: Map<unknown, NormalizedAssetField[]>
  storages: StorageRegistry
}

// A file at an asset field, with the storage and the size limit of the field:
interface AssetFieldFile {
  file: AssetFile
  storage: Storage
  maxSize?: number
}

interface ImportOptions {
  storages: StorageRegistry
  // Collects the stored files, even of imports that fail later.
  imported?: AssetFieldFile[]
  skipDisallowed?: boolean
}

const writeMethods = ['POST', 'PUT', 'PATCH']

// How long an import from a `url` may take.
const fetchTimeout = 30_000

// How many files a write imports at once.
const importConcurrency = 8

// Accept the files in the body that the `asset` table holds in the storage of
// their field, copy files of other storages, and import files without `asset`
// row from their `url` when the storage allows it. Change the files of the
// body in place, so that handlers read the stored files. This covers the rows
// of owned relations too, which a write sends with their parent.
export function defineAssetWrites({
  meta,
  fieldsByEntity,
  storages,
  getKysely
}: DefineAssetWritesOptions): MixinDefinition {
  return {
    middleware: async (c, next) => {
      const imported: AssetFieldFile[] = []
      // The transaction rolls the rows back, but not the files.
      const removeImported = () =>
        Promise.allSettled(
          imported.map(({ file, storage }) => storage.removeFile(file))
        )
      if (writeMethods.includes(c.req.method)) {
        const rows = getBodyRows(c.var.body, meta, fieldsByEntity)
        checkFiles(rows)
        const files = findFiles(rows, storages)
        if (files.length > 0) {
          const database = getKysely(c)
          try {
            // Files that can't be accepted throw a 400.
            const unreferenced = await importFiles(database, files, {
              storages,
              imported
            })
            // A file in a body is used again, so a release must skip it.
            const keys = [
              ...unreferenced,
              ...imported.map(({ file }) => file.key)
            ]
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
        }
      }
      await next()
      // Hono handles the errors of later handlers and sets `c.error`.
      if (c.error) await removeImported()
    }
  }
}

// The rows of a body or of an owned relation, an array or a single row, and of
// the owned relations inside them, at any depth.
function getBodyRows(
  value: unknown,
  meta: DefineAssetWritesOptions['meta'],
  fieldsByEntity: DefineAssetWritesOptions['fieldsByEntity'],
  path: AssetRow['path'] = []
): AssetRow[] {
  const fields = fieldsByEntity.get(meta.class) ?? []
  const owned = meta.relations.filter(prop => prop.orphanRemoval)
  return asArray(value).flatMap((row, index) => {
    if (isObject(row)) {
      const rowPath = isArray(value) && path.length ? [...path, index] : path
      return [
        { row, fields, path: rowPath },
        ...owned.flatMap(({ name, targetMeta }) =>
          getBodyRows(row[name], targetMeta!, fieldsByEntity, [
            ...rowPath,
            name
          ])
        )
      ]
    } else {
      return []
    }
  })
}

// Answer values at the asset fields that aren't files with 400, as
// `findFiles()` leaves them out and the write would store them as they are.
function checkFiles(rows: AssetRow[]) {
  const issues = rows.flatMap(({ row, fields, path }) =>
    fields.flatMap(({ property, dataPath }) =>
      findInvalidFiles(row[property], dataPath).map(filePath => ({
        path: [
          ...path,
          property,
          ...parseDataPath(normalizeDataPath(filePath))
        ],
        message: 'Invalid input: expected a stored file'
      }))
    )
  )
  if (issues.length > 0) throw createValidationError(issues, bodyValidation)
}

function findFiles(
  rows: AssetRow[],
  storages: StorageRegistry
): AssetFieldFile[] {
  return rows.flatMap(({ row, fields }) =>
    fields.flatMap(({ property, dataPath, storage, maxSize }) =>
      findAssetFiles(row[property], dataPath).map(({ file }) => ({
        file,
        storage: storages.get(storage),
        maxSize
      }))
    )
  )
}

// Give the files the properties of their stored files, and return the keys of
// the rows that they use and that a scan found unreferenced. Files that the
// `asset` table holds in their storage keep their key.
async function importFiles(
  database: Kysely<any>,
  files: AssetFieldFile[],
  options: ImportOptions
): Promise<string[]> {
  const getStorageKey = (storage: string, key: string) => `${storage}:${key}`
  const keys = [...new Set(files.map(({ file }) => file.key))]
  if (keys.length === 0) return []
  const assets = await database
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
            : await importFile(database, first, asset, options)
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
      ? await database
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
  database: Kysely<any>,
  { file, storage, maxSize }: AssetFieldFile,
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
  await insertAsset(database, stored, storage)
  return stored
}

// Seeds that insert rows import the files of their data first, such as
// `file://` files, and skip sources that the storage doesn't allow:
export async function importAssets<T extends object>(
  data: T,
  {
    table,
    fields,
    storages,
    database
  }: {
    table: string
    fields: NormalizedAssetField[]
    storages: StorageRegistry
    database: Kysely<any>
  }
) {
  const tableFields = fields.filter(field => field.table === table)
  const rows = asArray(data).map((row: any) => ({
    row,
    fields: tableFields,
    path: []
  }))
  const files = findFiles(rows, storages)
  await importFiles(database, files, { storages, skipDisallowed: true })
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

// The row stays unreferenced until a scan finds the file. If `database` is
// outside the transaction of the write that references the file and that write
// rolls back, the release deletes the file later.
export async function insertAsset(
  database: Kysely<any>,
  file: AssetFile,
  storage: Storage
) {
  const now = new Date()
  await database
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
  database: Kysely<any>,
  storage: Storage,
  options: StoreOptions
) {
  const file = await storage.store(options)
  try {
    await insertAsset(database, file, storage)
  } catch (error) {
    await storage.removeFile(file).catch(() => {})
    throw error
  }
  return file
}
