import {
  asArray,
  camelize,
  getEntriesAtDataPath,
  isArray,
  isObject,
  isString,
  normalizeDataPath,
  parseDataPath
} from '@ditojs/utils'
import type { AssetFile } from './Storage.ts'

// Where a table stores files: a column, and the data path of the files inside
// its JSON value, with `*` for one segment and `**` for any number of them.
// `''` is the column itself. A value at the path may be one file or an array of
// files. In request bodies, the column is the camelCase property, such as
// `cover_image` as `coverImage`.

export interface AssetPath {
  table: string
  column: string
  path: string
  // The name of the storage that holds the files.
  storage: string
  // The size limit of an upload, see `AssetUpload`.
  maxSize?: number | string
}

// Finds the file objects at `path` inside `value`, with their data paths.
// Values without a string `key` are skipped.
export function findAssetFiles(value: unknown, path: string) {
  return findValues(value, path).filter(
    (entry): entry is { file: AssetFile; path: string } =>
      isAssetFile(entry.file)
  )
}

// The data paths of the values at `path` inside `value` that aren't files.
// Requests can't store these, as the `asset` table doesn't check them.
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

// The data path of `path` in a row, with the column as its camelCase property.
export function getDataPath(column: string, path: string) {
  return normalizeDataPath([camelize(column), ...parseDataPath(path)])
}

function isAssetFile(value: unknown): value is AssetFile {
  return isObject(value) && isString(value.key)
}
