import { hyphenate, isFunction, parseDataPath } from '@ditojs/utils'
import type {
  Actions,
  DitoContext,
  FeatureDefinition
} from '@ditojs/server-next'
import { getTablePaths, getUploadPath, type AssetPath } from './asset-path.ts'
import { insertAsset } from './assets.ts'
import type { AssetDb } from './assets-feature.ts'
import { toStorageRegistry, type Storages } from './registry.ts'
import { uploadHandler, type UploadHandlerOptions } from './upload.ts'

// The upload routes of a controller, as Dito 6 sets them up from the
// `assets` of a controller: `post upload/<data path>` on the collection, with
// the tokens of the path hyphenated, such as `upload/custom-font-file`, and
// `*` and `**` as route parameters. Each route answers with the signed file
// objects that the admin's upload component expects, and inserts the `asset`
// rows of the files, unreferenced until a scan finds them. The rows commit
// and roll back with the request's transaction when `db` returns it.

export interface AssetUpload extends Omit<
  UploadHandlerOptions,
  'dataPath' | 'onUpload'
> {
  // The data path of the form field, with `*` and `**` wildcards.
  dataPath: string
  // The name of the storage that holds the files.
  storage: string
}

export interface UploadRoutesOptions {
  uploads: AssetUpload[]
  storages: Storages
  db: AssetDb
}

export function uploadRoutes({
  uploads,
  storages,
  db
}: UploadRoutesOptions): FeatureDefinition {
  const registry = toStorageRegistry(storages)
  const collection: Actions = {}
  for (const { dataPath, storage: name, ...options } of uploads) {
    const storage = registry.get(name)
    const route = parseDataPath(dataPath)
      .map((token: string, index: number) =>
        token === '*'
          ? `:p${index}{[^/]+}`
          : token === '**'
            ? `:p${index}{.+}`
            : hyphenate(token)
      )
      .join('/')
    collection[`post upload/${route}`] = uploadHandler(storage, {
      ...options,
      dataPath,
      onUpload: (c, files) =>
        insertAsset(
          isFunction(db) ? db(c as DitoContext) : db,
          files,
          storage
        )
    })
  }
  return { collection }
}

export interface AssetUploadsOptions extends Omit<
  UploadRoutesOptions,
  'uploads'
> {
  table: string
  paths: AssetPath[]
}

// The upload routes of the asset paths of `table`, one per upload path. The
// first asset path of an upload path sets its storage and `readDimensions`.
export function assetUploads({
  table,
  paths,
  ...options
}: AssetUploadsOptions) {
  const uploads = new Map<string, AssetUpload>()
  for (const path of getTablePaths(paths, table)) {
    const dataPath = getUploadPath(path)
    if (!uploads.has(dataPath)) {
      const { storage, readDimensions } = path
      uploads.set(dataPath, { dataPath, storage, readDimensions })
    }
  }
  if (uploads.size === 0) {
    throw new Error(`No asset paths for table '${table}'`)
  }
  return uploadRoutes({ uploads: [...uploads.values()], ...options })
}
