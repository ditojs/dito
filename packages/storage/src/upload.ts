import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import {
  escapeRegExp,
  normalizeDataPath,
  parseDataPath
} from '@ditojs/utils'
import { HttpError, type DitoContext } from '@ditojs/server-next'
import type { Storage, UploadOptions } from './storage.ts'
import type { AssetFileObject } from './asset-file.ts'

// The upload route of the Dito admin's upload component. It takes a multipart
// body, stores its files and answers with their signed file objects as a JSON
// array. The admin sends each file in its own request, under the data path of
// its field, and stores the first file object in the form's data.

export interface UploadHandlerOptions extends UploadOptions {
  // The field names to take files from, as a data path with `*` for one
  // segment and `**` for several, such as `images/*/file`. Files of other
  // fields are skipped. Without it, all files are taken.
  dataPath?: string
  limits?: {
    // The largest size of a file in bytes, answered with 413 when exceeded.
    fileSize?: number
    // The most files in one request, answered with 400 when exceeded.
    files?: number
  }
  // Runs after the files are stored and before they are sent, such as to
  // record them as assets. When it throws, the stored files are removed.
  onUpload?: (ctx: DitoContext, files: AssetFileObject[]) => unknown
}

// Returns the handler of a controller action, such as
// `'post upload/cover': uploadHandler(covers)`. It returns the file objects.
export function uploadHandler(
  storage: Storage,
  { dataPath, limits = {}, onUpload, ...options }: UploadHandlerOptions = {}
) {
  const matchesField = dataPath ? createFieldMatcher(dataPath) : () => true

  return async (ctx: DitoContext): Promise<AssetFileObject[]> => {
    const contentType = ctx.req.headers.get('Content-Type') ?? ''
    if (!contentType.startsWith('multipart/form-data')) {
      throw new HttpError(415, {
        detail: 'Uploads need a multipart/form-data body.'
      })
    }
    let body: FormData
    try {
      body = await ctx.req.formData()
    } catch {
      throw new HttpError(400, { detail: 'The multipart body is invalid.' })
    }
    const entries = [...body].flatMap(([field, value]) =>
      value instanceof File ? [{ field, file: value }] : []
    )
    if (limits.files != null && entries.length > limits.files) {
      throw new HttpError(400, { detail: 'Too many files.' })
    }
    const uploads = entries.filter(({ field }) => matchesField(field))
    for (const { file } of uploads) {
      if (limits.fileSize != null && file.size > limits.fileSize) {
        throw new HttpError(413, { detail: `File too large: ${file.name}` })
      }
    }
    const files: AssetFileObject[] = []
    try {
      for (const { file } of uploads) {
        files.push(
          await storage.upload(
            {
              name: file.name,
              type: file.type || undefined,
              stream: Readable.fromWeb(file.stream() as NodeReadableStream)
            },
            options
          )
        )
      }
      await onUpload?.(ctx, files)
    } catch (error) {
      await Promise.allSettled(files.map(file => storage.removeFile(file)))
      throw error
    }
    return files
  }
}

// Matches field names against a data path, where `*` matches one segment,
// such as a numeric id or `create`, and `**` matches several.
function createFieldMatcher(dataPath: string) {
  const pattern = parseDataPath(normalizeDataPath(dataPath))
    .map(token =>
      token === '*' ? '[^/]+' : token === '**' ? '.+?' : escapeRegExp(token)
    )
    .join('/')
  const regExp = new RegExp(`^${pattern}$`)
  return (field: string) => regExp.test(field)
}
