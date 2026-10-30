import fs from 'node:fs/promises'
import type { Kysely } from 'kysely'
import {
  asArray,
  camelize,
  clone,
  isFunction,
  isObject,
  mapConcurrently
} from '@ditojs/utils'
import type { DitoContext, FeatureDefinition } from '@ditojs/server-next'
import type { AssetFile, AssetFileObject } from './asset-file.ts'
import { resolveFileUrl, type Storage } from './storage.ts'
import { AssetError } from './errors.ts'
import {
  findAssetFiles,
  getTablePaths,
  parseJsonValue,
  type AssetPath
} from './asset-path.ts'
import { insertAsset } from './assets.ts'
import { toStorageRegistry, type Storages } from './registry.ts'

// The asset handling of a controller's writes, with the asset paths of its
// table. The paths are read in the body of `c.var.body()`, where the column of
// each path is its camelCase property, such as `custom_font_file` as
// `customFontFile`. A `body` schema of the action needs to keep the
// `signature` of files. The feature changes the files of the body in place,
// so handlers read them through `c.var.body()` without their signatures. It
// also signs the files of the rows that the controller sends. It reads JSON
// bodies only, so the multipart bodies of upload routes pass through.

// The database of the `asset` table, or a function that returns the one of
// the request, such as a Kysely on `c.var.db`.
export type AssetDb = Kysely<any> | ((c: DitoContext) => Kysely<any>)

export interface AssetsOptions {
  // Only the paths of this table are used, when set.
  table?: string
  storages: Storages
  db: AssetDb
}

interface ImportedFile {
  file: AssetFile
  storage: Storage
}

const writeMethods = ['POST', 'PUT', 'PATCH']

export function assets(
  allPaths: AssetPath[],
  { table, storages, db }: AssetsOptions
) {
  const paths = table ? getTablePaths(allPaths, table) : allPaths
  const registry = toStorageRegistry(storages)
  const getStorage = (name: string) => registry.get(name)

  const findFiles = (body: unknown) =>
    asArray(body).flatMap(item =>
      isObject(item)
        ? paths.flatMap(({ column, path, storage }) =>
            findAssetFiles(
              parseJsonValue(item[camelize(column)]),
              path
            ).map(({ file }) => ({ file, storage: getStorage(storage) }))
          )
        : []
    )

  const feature: FeatureDefinition = {
    around: async (c, next) => {
      if (
        !writeMethods.includes(c.req.method) ||
        !c.req.header('Content-Type')?.includes('json')
      ) {
        return next()
      }
      const body = await c.var.body()
      const files = findFiles(body)
      if (files.length === 0) return next()
      const database = isFunction(db) ? db(c) : db
      const imported: ImportedFile[] = []
      const removeImported = async () => {
        await Promise.allSettled(
          imported.map(({ file, storage }) => storage.removeFile(file))
        )
        const keys = imported.map(({ file }) => file.key)
        if (keys.length > 0) {
          await database.deleteFrom('asset').where('key', 'in', keys).execute()
        }
      }
      try {
        // Throws an `AssetError` on invalid signatures, answered with 400.
        for (const { file, storage } of files) {
          storage.convertAssetFile(file)
          // The body keeps plain objects, as parsed JSON has them.
          Object.setPrototypeOf(file, Object.prototype)
        }
        imported.push(...(await importFiles(database, files, getStorage)))
        // A file in a body is used again, so a release must skip it.
        const keys = [...new Set(files.map(({ file }) => file.key))]
        await database
          .updateTable('asset')
          .set({ unreferenced_since: null })
          .where('key', 'in', keys)
          .where('unreferenced_since', 'is not', null)
          .execute()
      } catch (error) {
        await removeImported()
        throw error
      }
      await next()
      if (c.error) await removeImported()
    },

    serialize: (_c, _row, json) => {
      if (!isObject(json)) return json
      const copy: Record<string, unknown> = { ...json }
      for (const { column, path, storage } of paths) {
        const property = camelize(column)
        if (copy[property] === undefined) continue
        // Copy the value, as the row may share it.
        if (copy[property] === json[property]) {
          copy[property] = clone(copy[property])
        }
        for (const { file } of findAssetFiles(copy[property], path)) {
          getStorage(storage).signAssetFile(file)
        }
      }
      return copy
    }
  }
  return feature
}

// Imports the files that the `asset` table doesn't hold in their storage, as
// Dito 6's `Application.addForeignAssets()` does: files of other storages are
// copied under new keys, and files without an asset row are fetched from
// their `url` if the storage allows it. The file objects in the body get the
// properties of the imported files.
async function importFiles(
  db: Kysely<any>,
  files: { file: AssetFileObject; storage: Storage }[],
  getStorage: (name: string) => Storage
) {
  const keys = [...new Set(files.map(({ file }) => file.key))]
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
  const imported: ImportedFile[] = []
  await mapConcurrently([...groups.values()], async group => {
    const [{ file, storage }] = group
    const asset = assetsByKey.get(file.key)
    if (asset?.storage === storage.name) return
    let importedFile: AssetFile
    if (asset) {
      // Keys are unique across all storages, so the copy needs a new one.
      const source: AssetFileObject = parseJsonValue(asset.file)
      const data = await getStorage(asset.storage).readFile(source)
      importedFile = await storage.addFile(
        { ...source, key: storage.getUniqueKey(source.name ?? source.key) },
        data
      )
    } else if (storage.isImportSourceAllowed(file.url)) {
      importedFile = await storage.addFile(
        { ...file },
        await fetchFile(file.url!)
      )
    } else {
      throw new AssetError(
        `Unable to import asset from foreign source: '${
          file.name ?? file.key
        }' ('${file.url ?? file.key}')`
      )
    }
    imported.push({ file: importedFile, storage })
    await insertAsset(db, importedFile, storage)
    for (const { file } of group) Object.assign(file, importedFile)
  })
  return imported
}

export interface ImportAssetsOptions {
  db: Kysely<any>
  table: string
  paths: AssetPath[]
  storages: Storages
}

// Imports the files that `data`, the values of a row of `table`, references
// but that no `asset` row holds yet, such as the `file://` files of seed
// data, and inserts their `asset` rows. Files from sources that the storage
// doesn't allow are skipped. The file objects in `data` get the properties
// of the stored files. Requests do this through `assets()`. Seeds that insert
// rows directly call this first.
export async function importAssets<T extends object>(
  data: T,
  { db, table, paths, storages }: ImportAssetsOptions
) {
  const registry = toStorageRegistry(storages)
  for (const path of getTablePaths(paths, table)) {
    const value = (data as Record<string, unknown>)[camelize(path.column)]
    const storage = registry.get(path.storage)
    for (const { file } of findAssetFiles(value, path.path)) {
      const asset = await db
        .selectFrom('asset')
        .select('file')
        .where('key', '=', file.key)
        .executeTakeFirst()
      if (asset) {
        // A file that the data references more than once is stored once.
        Object.assign(file, parseJsonValue(asset.file))
        continue
      }
      if (!storage.isImportSourceAllowed(file.url)) continue
      const stored = await storage.addFile(
        { ...file },
        await fetchFile(file.url!)
      )
      await insertAsset(db, stored, storage)
      Object.assign(file, stored)
    }
  }
  return data
}

async function fetchFile(url: string) {
  if (url.startsWith('file://')) {
    return fs.readFile(new URL(resolveFileUrl(url)))
  }
  const response = await fetch(url)
  if (!response.ok) {
    throw new AssetError(
      `Unable to import asset from '${url}': ${response.status}`
    )
  }
  return Buffer.from(await response.arrayBuffer())
}
