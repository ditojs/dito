import path from 'path'
import { isString } from '@ditojs/utils'

export function resolveFileUrl(url) {
  return url?.startsWith('file://')
    ? `file://${path.resolve(url.slice(7))}`
    : url
}

// Reads add the `url` of the file's storage, and responses add a new
// `signature`, so neither is stored. Values that aren't files, such as raw
// SQL, stay as they are.
export function formatDatabaseFile(file) {
  if (isString(file?.key)) {
    const { url, signature, ...rest } = file
    return rest
  }
  return file
}
