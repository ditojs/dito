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
import type { AssetFileObject } from './Storage.ts'

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
}

// Finds the file objects at `path` inside `value`, with their data paths.
// Values without a string `key` are skipped.
export function findAssetFiles(value: unknown, path: string) {
  const files: { file: AssetFileObject; path: string }[] = []
  // Deep wildcards can reach the same location in several ways.
  const filePaths = new Set<string>()
  const entries = getEntriesAtDataPath(value, path, () => undefined)
  for (const [entryPath, entry] of Object.entries(entries)) {
    for (const [index, file] of asArray(entry).entries()) {
      const filePath = isArray(entry)
        ? [entryPath, index].filter(part => part !== '').join('/')
        : entryPath
      if (isAssetFileObject(file) && !filePaths.has(filePath)) {
        filePaths.add(filePath)
        files.push({ file, path: filePath })
      }
    }
  }
  return files
}

// The data path of `path` in a row, with the column as its camelCase property.
export function getDataPath(column: string, path: string) {
  return normalizeDataPath([camelize(column), ...parseDataPath(path)])
}

function isAssetFileObject(value: unknown): value is AssetFileObject {
  return isObject(value) && isString(value.key)
}
