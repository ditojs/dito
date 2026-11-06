import { tryGetContext } from 'hono/context-storage'
import { guardEntity } from '@ditojs/mikro'
import { isString, parseDuration } from '@ditojs/utils'
import type { Adapter, DitoContext, MixinDefinition } from '@ditojs/server'
import type { StoreOptions } from './Storage.ts'
import {
  getDataPath,
  normalizeAssetPaths,
  parseMaxSize,
  type AssetPath
} from './assetPaths.ts'
import {
  findAssetReferences,
  runAssetJobs,
  type FindAssetReferencesOptions
} from './assetJobs.ts'
import {
  defineAssetWrites,
  importAssets,
  storeAsset
} from './assetWrites.ts'
import type { StorageRegistry } from './StorageRegistry.ts'
import { defineAssetUploads, type AssetUpload } from './assetUploads.ts'

export interface CreateAssetsOptions {
  // The adapter of the API, such as `createMikroAdapter(orm)`.
  adapter: Adapter
  paths: AssetPath[]
  storages: StorageRegistry
  // The `deleteUnusedAfter` of `runJobs()`, in milliseconds or as a duration
  // such as `'24h'`, unless a call passes its own. By default, `false` skips
  // the release.
  deleteUnusedAfter?: number | string | false
  // The `maxSize` of the asset paths and uploads without their own, as in
  // `AssetUpload`.
  maxSize?: number | string
}

export interface DefineUploadsOptions {
  // Uploads of fields that no asset path describes, with globs as `path`.
  uploads?: AssetUpload[]
}

export function createAssets({
  adapter,
  paths,
  storages,
  deleteUnusedAfter = false,
  maxSize
}: CreateAssetsOptions) {
  // Throw for unknown storages and invalid values here, not in the requests:
  for (const path of paths) storages.get(path.storage)
  const defaultDeleteUnusedAfter = parseDeleteUnusedAfter(deleteUnusedAfter)
  const defaultMaxSize = parseMaxSize(maxSize)
  const normalizedPaths = normalizeAssetPaths(paths, defaultMaxSize)
  // Writes and uploads use the Kysely of the request, so that the `asset` rows
  // of a write commit with its transaction. The other methods run outside of
  // the requests' transactions.
  const getDatabase = (c: DitoContext) => adapter.getKysely(c)
  // All model controllers of the entities track the files of their writes:
  const pathsByEntity = Map.groupBy(normalizedPaths, path => path.entity)
  for (const [entity, paths] of pathsByEntity) {
    guardEntity(
      entity,
      'assets',
      defineAssetWrites({ paths, storages, getDatabase })
    )
  }

  return {
    paths,
    storages,

    // Define the upload action of the table's asset paths, with the camelCase
    // column followed by the path of each, such as `pages/*/images`, and of
    // `uploads`. Without a table, only of `uploads`.
    defineUploads(
      table: string | DefineUploadsOptions,
      options: DefineUploadsOptions = {}
    ): MixinDefinition {
      const name = isString(table) ? table : undefined
      const { uploads = [] } = isString(table) ? options : table
      for (const upload of uploads) storages.get(upload.storage)
      const tableUploads = normalizedPaths
        .filter(path => path.table === name)
        .map(({ column, path, storage, maxSize }) => ({
          path: getDataPath(column, path),
          storage,
          maxSize
        }))
      if (name && tableUploads.length === 0) {
        throw new Error(`No asset paths for table '${name}'`)
      }
      return defineAssetUploads({
        uploads: [
          ...tableUploads,
          ...uploads.map(upload => ({
            ...upload,
            maxSize: parseMaxSize(upload.maxSize) ?? defaultMaxSize
          }))
        ],
        storages,
        getDatabase
      })
    },

    // The row commits at once, as the file stays when a request rolls back,
    // so that the release deletes it:
    store(storage: string, options: StoreOptions) {
      return storeAsset(adapter.getKysely(), storages.get(storage), options)
    },

    // Import the files of seed data, with rows that commit at once, as in
    // `store()`:
    import<T extends object>(table: string, data: T) {
      return importAssets(data, {
        table,
        paths: normalizedPaths,
        storages,
        database: adapter.getKysely()
      })
    },

    // Read in the transaction of the running request, if there is one:
    findReferences(
      options: Omit<FindAssetReferencesOptions, 'database' | 'paths'> = {}
    ) {
      return findAssetReferences({
        ...options,
        database: adapter.getKysely(tryGetContext()),
        paths
      })
    },

    runJobs(
      options: {
        dryRun?: boolean
        now?: Date
        deleteUnusedAfter?: number | string | false
      } = {}
    ) {
      return runAssetJobs({
        ...options,
        database: adapter.getKysely(),
        paths,
        storages,
        deleteUnusedAfter:
          options.deleteUnusedAfter != null
            ? parseDeleteUnusedAfter(options.deleteUnusedAfter)
            : defaultDeleteUnusedAfter
      })
    }
  }
}

export type Assets = ReturnType<typeof createAssets>

function parseDeleteUnusedAfter(
  deleteUnusedAfter: number | string | false
): number | false {
  return deleteUnusedAfter === false ? false : parseDuration(deleteUnusedAfter)
}
