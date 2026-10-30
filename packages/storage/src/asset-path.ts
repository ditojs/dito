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
import type { AssetFileObject } from './asset-file.ts'

// Where a table stores files: a column, and the data path of the files inside
// its JSON value, with `*` for one segment and `**` for any number of them, as
// in Dito 6's `static assets`. `''` is the column itself. A value at the path
// may be one file or an array of files. In request bodies, the column is the
// camelCase property, such as `custom_font_file` as `customFontFile`.

export interface AssetPath {
  table: string
  column: string
  path: string
  // The name of the storage that holds the files.
  storage: string
  // Reads the width and height of uploaded images and videos.
  readDimensions?: boolean
  // The data path of the upload route, when it differs from the column's
  // property followed by `path`, see `getUploadPath()`.
  upload?: string
}

// The data path of the upload route of an asset path, such as
// `pages/*/images` for the column `pages` with the path `*/images`.
export function getUploadPath({ column, path, upload }: AssetPath): string {
  return upload ?? normalizeDataPath([camelize(column), ...parseDataPath(path)])
}

// The asset paths of one table.
export function getTablePaths(paths: AssetPath[], table: string) {
  return paths.filter(path => path.table === table)
}

export interface FoundAssetFile {
  file: AssetFileObject
  // The data path of the file inside the value, such as `items/2/file`.
  path: string
}

// Finds the file objects at `path` inside `value`, as Dito 6's
// `Model._getAssetFiles()` does. Values without a string `key` are skipped.
export function findAssetFiles(value: unknown, path: string) {
  const files: FoundAssetFile[] = []
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

export function isAssetFileObject(value: unknown): value is AssetFileObject {
  return isObject(value) && isString(value.key)
}

// `json` columns, and all JSON in SQLite, arrive as strings.
export function parseJsonValue(value: unknown) {
  if (isString(value)) {
    try {
      return JSON.parse(value as string)
    } catch {
      // A text column that holds no JSON.
    }
  }
  return value
}
