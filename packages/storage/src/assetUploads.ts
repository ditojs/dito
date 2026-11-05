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

export interface AssetUpload {
  // A glob of camelCase data paths, such as `pages/*/images`.
  path: string
  // The name of the storage that holds the files.
  storage: string
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
  const matchers = uploads.map(({ path, storage }) => ({
    isMatch: picomatch(path),
    storage
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
          let body: FormData
          try {
            body = await c.req.formData()
          } catch {
            throw new HttpError(400, {
              message: 'The multipart body is invalid.'
            })
          }
          const storage = storages.get(upload.storage)
          const files: AssetFile[] = []
          try {
            for (const value of body.values()) {
              if (value instanceof File) {
                files.push(
                  await storeAsset(db(c), storage, {
                    name: value.name,
                    type: value.type,
                    data: Buffer.from(await value.arrayBuffer())
                  })
                )
              }
            }
          } catch (error) {
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
