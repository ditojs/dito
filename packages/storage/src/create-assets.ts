import type { Kysely } from 'kysely'
import { isString } from '@ditojs/utils'
import type { MixinDefinition } from '@ditojs/server'
import type { Storage, StoreOptions } from './Storage.ts'
import type { AssetPath } from './asset-path.ts'
import { assets, importAssets, type AssetDb } from './assets-feature.ts'
import {
  findAssetReferences,
  runAssetJobs,
  storeAsset,
  type FindAssetReferencesOptions
} from './assets.ts'
import type { StorageRegistry } from './registry.ts'
import { assetUploads } from './upload.ts'

// Binds the asset functions to an app's asset paths and storages. Each method
// calls one of the exported functions, which apps can call instead.

export interface CreateAssetsOptions {
  paths: AssetPath[]
  storages: StorageRegistry
  // The Kysely of a request, for the mixins.
  db: AssetDb
  // The `deleteUnusedAfter` of `runJobs()`, in milliseconds. By default,
  // `false` skips the release.
  deleteUnusedAfter?: number | false
}

export function createAssets({
  paths,
  storages,
  db,
  deleteUnusedAfter = false
}: CreateAssetsOptions) {
  return {
    paths,
    storages,

    // The `assets()` mixin of the table's writes, and with `uploads` the
    // upload action of `assetUploads()`.
    mixin(table: string, { uploads = true } = {}): MixinDefinition {
      const options = { table, paths, storages, db }
      return {
        mixins: uploads
          ? [assets(options), assetUploads(options)]
          : [assets(options)]
      }
    },

    // Stores a file that the server creates, and inserts its `asset` row.
    store(
      database: Kysely<any>,
      storage: string | Storage,
      options: StoreOptions
    ) {
      return storeAsset(
        database,
        isString(storage) ? storages.get(storage) : storage,
        options
      )
    },

    // Imports the files that `data`, a row of `table`, references, such as the
    // files of seed data.
    import<T extends object>(database: Kysely<any>, table: string, data: T) {
      return importAssets(data, { table, paths, storages, db: database })
    },

    references(
      database: Kysely<any>,
      options: Omit<FindAssetReferencesOptions, 'db' | 'paths'> = {}
    ) {
      return findAssetReferences({ ...options, db: database, paths })
    },

    // Scans the references and releases the files unreferenced for longer
    // than `deleteUnusedAfter`.
    runJobs(
      database: Kysely<any>,
      { dryRun, now }: { dryRun?: boolean; now?: Date } = {}
    ) {
      return runAssetJobs({
        db: database,
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
