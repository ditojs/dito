import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import busboy from 'busboy'
import picomatch from 'picomatch'
import { camelize } from '@ditojs/utils'
import type { MikroAdapter } from '@ditojs/mikro'
import {
  HttpError,
  defineAction,
  type MixinDefinition
} from '@ditojs/server'
import type { AssetFile } from './Storage.ts'
import { storeAsset } from './assetWrites.ts'
import type { StorageRegistry } from './StorageRegistry.ts'

export interface AssetUpload {
  // A glob of camelCase data paths, such as `pages/*/images`.
  dataPath: string
  // The name of the storage that holds the files.
  storage: string
  // The size limit of each file, in bytes, or as a string with a unit, such as
  // `'500mb'`.
  maxSize?: number | string
}

export interface NormalizedAssetUpload extends Omit<AssetUpload, 'maxSize'> {
  maxSize?: number
}

export interface DefineAssetUploadsOptions {
  uploads: NormalizedAssetUpload[]
  // The uploads of the asset fields of model controllers.
  uploadsByEntity: Map<object, NormalizedAssetUpload[]>
  storages: StorageRegistry
  getKysely: MikroAdapter['getKysely']
}

// Define the action of the Dito admin's upload component,
// `post upload/<data path>`, such as `upload/pages/3/images`, which stores the
// files in the storage of the first upload whose glob matches the camelized
// path. It tries the uploads of the entity of the model controller first:
export function defineAssetUploads({
  uploads,
  uploadsByEntity,
  storages,
  getKysely
}: DefineAssetUploadsOptions): MixinDefinition {
  const createMatchers = (uploads: NormalizedAssetUpload[]) =>
    uploads.map(upload => ({ ...upload, isMatch: picomatch(upload.dataPath) }))
  const matchers = createMatchers(uploads)
  const matchersByEntity = new Map(
    [...uploadsByEntity].map(([entity, uploads]) => [
      entity,
      createMatchers(uploads)
    ])
  )
  return {
    actions: {
      'post upload/:path{.+}': defineAction({
        // A transaction would stay open while the files are written. The
        // release removes the files that no write ends up referencing.
        transacted: false,
        handler: async ({ params, c }) => {
          const path = params.path
            .split('/')
            .map(segment => camelize(segment))
            .join('/')
          const upload = [
            ...(matchersByEntity.get(c.var.entity) ?? []),
            ...matchers
          ].find(({ isMatch }) => isMatch(path))
          if (!upload) throw new HttpError(404)
          const contentType = c.req.header('Content-Type') ?? ''
          if (!contentType.startsWith('multipart/form-data')) {
            throw new HttpError(415, {
              message: 'Uploads need a multipart/form-data body.'
            })
          }
          const storage = storages.get(upload.storage)
          const database = getKysely()
          const parser = busboy({
            headers: { 'content-type': contentType },
            limits: { fileSize: upload.maxSize }
          })
          // Store the files one after another, and after a failed one, only
          // read the rest of the body:
          const results: Promise<AssetFile>[] = []
          parser.on('file', (_name, stream, { filename, mimeType }) => {
            // busboy also gives untyped parts without a filename as files,
            // which `formData()` reads as fields:
            if (filename !== undefined) {
              // A file that waits for the previous one has no reader yet, and
              // would throw the error of an abort. Its store reads it later:
              stream.on('error', () => {})
              const result = (results.at(-1) ?? Promise.resolve()).then(() =>
                storeAsset(database, storage, {
                  name: filename,
                  type: mimeType,
                  data: readUploadData(stream)
                })
              )
              // Read the rest of files that fail, so that parsing goes on
              // to the end of the body, and the request ends cleanly:
              result.catch(() => stream.resume())
              results.push(result)
            } else {
              stream.resume()
            }
          })
          let error: unknown
          try {
            // `pipeline()` destroys the parser and the file that it reads
            // when the client aborts:
            await pipeline(Readable.from(c.req.raw.body ?? []), parser)
          } catch {
            error = new HttpError(400, {
              message: 'The multipart body is invalid.'
            })
          }
          // Remove the stored files and their rows when the body or any of the
          // files fail. The release removes the rows of files that stay:
          const settled = await Promise.allSettled(results)
          const files = settled
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value)
          error ??= settled.find(result => result.status === 'rejected')?.reason
          if (error) {
            await Promise.allSettled(
              files.map(async file => {
                await storage.removeFile(file)
                await database
                  .deleteFrom('asset')
                  .where('key', '=', file.key)
                  .execute()
              })
            )
            throw error
          }
          return files
        }
      })
    }
  }
}

// Fail with 413 when busboy cut the file at `maxSize`. Stopping early leaves
// the stream for busboy to drain:
async function* readUploadData(stream: Readable & { truncated?: boolean }) {
  yield* stream.iterator({ destroyOnReturn: false })
  if (stream.truncated) throw new HttpError(413)
}
