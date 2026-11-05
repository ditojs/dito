import type { Kysely } from 'kysely'
import { isString } from '@ditojs/utils'
import type { DitoContext, MixinDefinition } from '@ditojs/server'
import type { Storage, StoreOptions } from './Storage.ts'
import { getDataPath, type AssetPath } from './assetPaths.ts'
import {
  findAssetReferences,
  runAssetJobs,
  type FindAssetReferencesOptions
} from './assetJobs.ts'
import { assets, importAssets, storeAsset } from './assetWrites.ts'
import type { StorageRegistry } from './StorageRegistry.ts'
import { uploadRoutes, type AssetUpload } from './assetUploads.ts'

// Binds the asset handling to an app's adapter, asset paths and storages. The
// mixins use the Kysely of the request's handle, `c.var.db`, so that the
// `asset` rows of a write commit with its transaction. The other methods use
// the Kysely of the adapter, outside of the requests' transactions.

export interface CreateAssetsOptions {
  // The adapter of the API, such as `createMikroAdapter(orm)`.
  adapter: { getKysely(): Kysely<any> }
  paths: AssetPath[]
  storages: StorageRegistry
  // The `deleteUnusedAfter` of `runJobs()`, in milliseconds. By default,
  // `false` skips the release.
  deleteUnusedAfter?: number | false
}

export interface DefineUploadsOptions {
  // Uploads of fields that no asset path describes, with globs as `path`.
  uploads?: AssetUpload[]
}

export function createAssets({
  adapter,
  paths,
  storages,
  deleteUnusedAfter = false
}: CreateAssetsOptions) {
  const getDb = (c: DitoContext) =>
    (c.var.db as { getKysely(): Kysely<any> }).getKysely()

  return {
    paths,
    storages,

    // Handles the files in the bodies of the table's writes.
    defineWrites(table: string): MixinDefinition {
      return assets({ table, paths, storages, db: getDb })
    },

    // The upload action of the table's asset paths, with the camelCase column
    // followed by the path of each, such as `pages/*/images`, and of `uploads`.
    // Without a table, only of `uploads`.
    defineUploads(
      table: string | DefineUploadsOptions,
      options: DefineUploadsOptions = {}
    ): MixinDefinition {
      const [name, { uploads = [] }] = isString(table)
        ? [table, options]
        : [undefined, table]
      const tableUploads = paths
        .filter(path => path.table === name)
        .map(({ column, path, storage }) => ({
          path: getDataPath(column, path),
          storage
        }))
      if (name && tableUploads.length + uploads.length === 0) {
        throw new Error(`No asset paths for table '${name}'`)
      }
      return uploadRoutes({
        uploads: [...tableUploads, ...uploads],
        storages,
        db: getDb
      })
    },

    // Stores a file that the server creates, and inserts its `asset` row.
    store(storage: string | Storage, options: StoreOptions) {
      return storeAsset(
        adapter.getKysely(),
        isString(storage) ? storages.get(storage) : storage,
        options
      )
    },

    // Imports the files that `data`, a row of `table`, references, such as the
    // files of seed data.
    import<T extends object>(table: string, data: T) {
      return importAssets(data, {
        table,
        paths,
        storages,
        db: adapter.getKysely()
      })
    },

    // Lists the files that the rows reference at the asset paths.
    findReferences(
      options: Omit<FindAssetReferencesOptions, 'db' | 'paths'> = {}
    ) {
      return findAssetReferences({ ...options, db: adapter.getKysely(), paths })
    },

    // Scans the references and releases the files unreferenced for longer
    // than `deleteUnusedAfter`.
    runJobs({ dryRun, now }: { dryRun?: boolean; now?: Date } = {}) {
      return runAssetJobs({
        db: adapter.getKysely(),
        paths,
        storages,
        deleteUnusedAfter,
        dryRun,
        now
      })
    }
  }
}

export type Assets = ReturnType<typeof createAssets>
