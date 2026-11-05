import { Readable } from 'node:stream'
import busboy from 'busboy'
import picomatch from 'picomatch'
import { camelize } from '@ditojs/utils'
import { HttpError, defineAction, type MixinDefinition } from '@ditojs/server'
import type { AssetFile } from './Storage.ts'
import { storeAsset, type AssetDb } from './assetWrites.ts'
import type { StorageRegistry } from './StorageRegistry.ts'

// The upload action of the Dito admin's upload component:
// `post upload/<data path>`, such as `upload/pages/3/images`. It camelizes each
// segment of the path, stores the files of the multipart body in the storage of
// the first upload whose glob matches it, and responds with the file objects.
// It runs without a transaction, which would stay open while the files are
// written. A release removes the files that no write ends up referencing.
// The files stream from the body into the storage, and files over the upload's
// `maxSize` get 413.

export interface AssetUpload {
  // A glob of camelCase data paths, such as `pages/*/images`.
  path: string
  // The name of the storage that holds the files.
  storage: string
  // The size limit of each file, in bytes.
  maxSize?: number
}

export interface UploadRoutesOptions {
  uploads: AssetUpload[]
  storages: StorageRegistry
  db: AssetDb
}

export function uploadRoutes({
  uploads,
  storages,
  db
}: UploadRoutesOptions): MixinDefinition {
  // Throws for the storages that the registry doesn't have.
  for (const upload of uploads) storages.get(upload.storage)
  const matchers = uploads.map(({ path, storage, maxSize }) => ({
    isMatch: picomatch(path),
    storage,
    maxSize
  }))
  return {
    actions: {
      'post upload/:path{.+}': defineAction({
        transacted: false,
        handler: async ({ params, c }) => {
          const path = params.path
            .split('/')
            .map(segment => camelize(segment))
            .join('/')
          const upload = matchers.find(({ isMatch }) => isMatch(path))
          if (!upload) throw new HttpError(404)
          const contentType = c.req.header('Content-Type') ?? ''
          if (!contentType.startsWith('multipart/form-data')) {
            throw new HttpError(415, {
              message: 'Uploads need a multipart/form-data body.'
            })
          }
          const storage = storages.get(upload.storage)
          const database = db(c)
          const results: Promise<AssetFile>[] = []
          let error: unknown
          try {
            await new Promise((resolve, reject) => {
              const parser = busboy({
                headers: { 'content-type': contentType },
                limits: { fileSize: upload.maxSize }
              })
              parser.on('file', (_name, stream, { filename, mimeType }) => {
                // busboy also gives untyped parts without a filename as files,
                // which `formData()` reads as fields:
                if (filename !== undefined) {
                  const result = storeAsset(database, storage, {
                    name: filename,
                    type: mimeType,
                    data: readFile(stream)
                  })
                  // Read the rest of files that fail, so that parsing goes on
                  // to the end of the body, and the request ends cleanly:
                  result.catch(() => stream.resume())
                  results.push(result)
                } else {
                  stream.resume()
                }
              })
              parser.on('close', resolve)
              parser.on('error', reject)
              Readable.from(c.req.raw.body ?? []).pipe(parser)
            })
          } catch {
            error = new HttpError(400, {
              message: 'The multipart body is invalid.'
            })
          }
          // Remove the stored files when the body or any of the files fail:
          const settled = await Promise.allSettled(results)
          const files = settled
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value)
          error ??= settled.find(result => result.status === 'rejected')?.reason
          if (error) {
            await Promise.allSettled(
              files.map(file => storage.removeFile(file))
            )
            throw error
          }
          return files
        }
      })
    }
  }
}

// The data of a file of the multipart body, which fails with 413 when busboy
// cut it at `maxSize`. Stopping early leaves the stream for busboy to drain:
async function* readFile(stream: Readable & { truncated?: boolean }) {
  yield* stream.iterator({ destroyOnReturn: false })
  if (stream.truncated) throw new HttpError(413)
}
