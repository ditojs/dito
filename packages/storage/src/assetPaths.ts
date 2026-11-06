import {
  asArray,
  camelize,
  getEntriesAtDataPath,
  isArray,
  isObject,
  isString,
  normalizeDataPath,
  parseDataPath,
  parseFileSize
} from '@ditojs/utils'
import type { EntityClass } from '@mikro-orm/core'
import { isValidKey, type AssetFile } from './Storage.ts'

// Where a table stores files, one file or an array of them per value:
export interface AssetPath {
  // The entity of the table, whose model controllers track the files. Without
  // it, only the jobs read the path, as in a migration.
  entity?: EntityClass<any>
  table: string
  column: string
  // The data path of the files inside the column's JSON value, with `*` for
  // one segment and `**` for any number of them, and `''` for the column.
  path: string
  // The name of the storage that holds the files.
  storage: string
  // The size limit of the uploads, imports and copies of its files, as in
  // `AssetUpload`.
  maxSize?: number | string
}

export interface NormalizedAssetPath extends Omit<AssetPath, 'maxSize'> {
  // The column as the camelCase property of request bodies, such as
  // `cover_image` as `coverImage`.
  property: string
  maxSize?: number
}

// Paths without their own `maxSize` get the default `maxSize`.
export function normalizeAssetPaths(
  paths: AssetPath[],
  maxSize?: number
): NormalizedAssetPath[] {
  return paths.map(path => ({
    ...path,
    property: camelize(path.column),
    maxSize: parseMaxSize(path.maxSize) ?? maxSize
  }))
}

// Values without a valid `key` aren't files.
export function findAssetFiles(value: unknown, path: string) {
  return findValues(value, path).filter(
    (entry): entry is { file: AssetFile; path: string } =>
      isAssetFile(entry.file)
  )
}

// Requests can't store values that aren't files, as the `asset` table doesn't
// check them.
export function findInvalidFiles(value: unknown, path: string) {
  return findValues(value, path)
    .filter(({ file }) => file != null && !isAssetFile(file))
    .map(({ path }) => path)
}

function findValues(value: unknown, path: string) {
  const values: { file: unknown; path: string }[] = []
  // Deep wildcards can reach the same location in several ways.
  const filePaths = new Set<string>()
  const entries = getEntriesAtDataPath(value, path, () => undefined)
  for (const [entryPath, entry] of Object.entries(entries)) {
    for (const [index, file] of asArray(entry).entries()) {
      const filePath = isArray(entry)
        ? [entryPath, index].filter(part => part !== '').join('/')
        : entryPath
      if (!filePaths.has(filePath)) {
        filePaths.add(filePath)
        values.push({ file, path: filePath })
      }
    }
  }
  return values
}

// The column becomes its camelCase property, as in request bodies.
export function getDataPath(column: string, path: string) {
  return normalizeDataPath([camelize(column), ...parseDataPath(path)])
}

export function parseMaxSize(maxSize: number | string | undefined) {
  return maxSize != null ? parseFileSize(maxSize) : undefined
}

function isAssetFile(value: unknown): value is AssetFile {
  return isObject(value) && isString(value.key) && isValidKey(value.key)
}
