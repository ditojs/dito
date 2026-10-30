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
import { findAssetFiles, parseJsonValue, type AssetPath } from './asset-path.ts'
import { insertAsset } from './assets.ts'

// The asset handling of a controller's writes, with the asset paths of its
// table. The paths are read in the JSON body, where the column of each path is
// its camelCase property, such as `custom_font_file` as `customFontFile`. The
// body is the validated one when the action has a `body` schema, which then
// needs to keep the `signature` of files, and else the parsed JSON body. The
// feature also signs the files of the rows that the controller sends.

export interface AssetsOptions {
  // The storages by name.
  storages: Record<string, Storage>
  // The database of the `asset` table, or a function that returns the one of
  // the request, such as a Kysely on `c.var.db`.
  db: Kysely<any> | ((c: DitoContext) => Kysely<any>)
}

interface ImportedFile {
  file: AssetFile
  storage: Storage
}

const writeMethods = ['POST', 'PUT', 'PATCH']

export function assets(paths: AssetPath[], { storages, db }: AssetsOptions) {
  const getStorage = (name: string) => {
    const storage = storages[name]
    if (!storage) throw new Error(`Unknown storage '${name}'`)
    return storage
  }

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
      if (!writeMethods.includes(c.req.method)) return next()
      const body = await readBody(c)
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
        for (const { file, storage } of files) storage.convertAssetFile(file)
        imported.push(...(await importFiles(database, files, getStorage)))
        // A file in a body is used again, so a release must skip it.
        const keys = [...new Set(files.map(({ file }) => file.key))]
        await database
          .updateTable('asset')
          .set({ unreferenced_since: null })
          .where('key', 'in', keys)
          .where('unreferenced_since', 'is not', null)
          .execute()
        writeBody(c, body)
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

// The handler reads the validated body if the action has a schema, and else
// parses the text of the body itself.
async function readBody(c: DitoContext) {
  const valid = c.req.valid('json' as never)
  if (valid !== undefined) return valid
  try {
    const text = await c.req.text()
    return text ? JSON.parse(text) : undefined
  } catch {
    // The handler answers invalid JSON.
    return undefined
  }
}

function writeBody(c: DitoContext, body: unknown) {
  if (c.req.valid('json' as never) !== undefined) return
  // Hono reads all body methods from this cache. It holds promises, which its
  // types leave out.
  c.req.bodyCache = { text: Promise.resolve(JSON.stringify(body)) as never }
}
