import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import {
  asArray,
  escapeRegExp,
  normalizeDataPath,
  parseDataPath
} from '@ditojs/utils'
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
  onUpload?: (c: Context<any>, files: AssetFileObject[]) => unknown
}

// Returns a Hono handler, which also serves as the handler of a controller
// action, such as `'post upload/cover': uploadHandler(covers)`.
export function uploadHandler(
  storage: Storage,
  { dataPath, limits = {}, onUpload, ...options }: UploadHandlerOptions = {}
) {
  const matchesField = dataPath ? createFieldMatcher(dataPath) : () => true

  return async (c: Context<any>): Promise<Response> => {
    const contentType = c.req.header('Content-Type') ?? ''
    if (!contentType.startsWith('multipart/form-data')) {
      throw new HTTPException(415, {
        message: 'Uploads need a multipart/form-data body'
      })
    }
    let body: Record<string, unknown>
    try {
      body = await c.req.parseBody({ all: true })
    } catch {
      throw new HTTPException(400, { message: 'Invalid multipart body' })
    }
    const entries = Object.entries(body).flatMap(([field, value]) =>
      asArray(value)
        .filter(value => value instanceof File)
        .map(file => ({ field, file: file as File }))
    )
    if (limits.files != null && entries.length > limits.files) {
      throw new HTTPException(400, { message: 'Too many files' })
    }
    const uploads = entries.filter(({ field }) => matchesField(field))
    for (const { file } of uploads) {
      if (limits.fileSize != null && file.size > limits.fileSize) {
        throw new HTTPException(413, {
          message: `File too large: ${file.name}`
        })
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
      await onUpload?.(c, files)
    } catch (error) {
      await Promise.allSettled(files.map(file => storage.removeFile(file)))
      throw error
    }
    return c.json(files)
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
