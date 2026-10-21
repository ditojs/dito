import { asArray, isRegExp, isString } from '@ditojs/utils'
import { getSchemaValue } from './schema/data.js'
import { parseFileSize } from './units.js'
import type { Context } from './schema/types.ts'
import type { Schema } from './types.ts'

export interface UploadLimits {
  extensions: string[] | string | RegExp | undefined
  maxSize: number | undefined
}

export function getUploadLimits(
  schema: Schema,
  context: Context
): UploadLimits {
  const extensions = getSchemaValue('extensions', {
    schema,
    context,
    type: [Array, String, RegExp]
  })
  const maxSize = getSchemaValue('maxSize', {
    schema,
    context,
    type: [String, Number]
  })
  return { extensions, maxSize: maxSize ? parseFileSize(maxSize) : undefined }
}

// Match the extensions like `VueUpload` does, see its `iExtensions`:
export function isAcceptedFile(
  file: { name: string; size: number },
  { extensions, maxSize }: UploadLimits
): boolean {
  const pattern = getExtensionsPattern(extensions)
  return (
    (!pattern || file.name.search(pattern) !== -1) &&
    !(maxSize && file.size > maxSize)
  )
}

function getExtensionsPattern(extensions: UploadLimits['extensions']) {
  if (isRegExp(extensions)) {
    return extensions
  } else {
    const pattern = asArray(
      isString(extensions) ? extensions.split(',') : extensions
    )
      .map((name: string) => name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(Boolean)
      .join('|')
    return pattern ? new RegExp(`\\.(${pattern})$`, 'i') : null
  }
}

export function asFiles(value: any): any[] {
  return value ? asArray(value) : []
}

// Filter out added files that weren't uploaded:
export function getStoredFiles(value: any): any[] {
  return asFiles(value)
    .map(({ upload, ...file }) => (!upload || upload.success ? file : null))
    .filter(file => file)
}
