import fs from 'fs'
import path from 'path'
import { getDataUri } from './css'

const cache = {}

// A node-sass importer that allows to inline the content of the file referenced
// in the`url()` statement as a data URI, preserving prefixes and suffixes
// included around the `url()` statement:
//
//   @import 'background: url(./icons/icon.svg) no-repeat left content-box'

export function dataUriImporter(file, prev) {
  const match = file.match(/^(.*?)url\(([^)]*)\)(.*)$/)
  if (match) {
    const [, prefix, filePath, suffix] = match
    const fullPath = path.resolve(path.dirname(prev), filePath)
    const { mtimeMs: modified } = fs.statSync(fullPath)
    const cached = cache[fullPath]
    if (cached?.modified === modified) {
      return cached
    } else {
      const data = getDataUri(fullPath)
      const resource = {
        modified,
        contents: `&{${prefix}url("${data}")${suffix}}`
      }
      cache[fullPath] = resource
      return resource
    }
  } else {
    return null
  }
}
