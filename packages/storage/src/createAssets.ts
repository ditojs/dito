import { tryGetContext } from 'hono/context-storage'
import { parseDuration } from '@ditojs/utils'
import type { EntityMetadata } from '@mikro-orm/core'
import type { MixinDefinition } from '@ditojs/server'
import type { MikroAdapter } from '@ditojs/mikro'
import type { StoreOptions } from './Storage.ts'
import {
  getDataPath,
  normalizeAssetFields,
  parseMaxSize,
  type AssetField
} from './assetFields.ts'
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
import {
  defineAssetUploads,
  type AssetUpload,
  type NormalizedAssetUpload
} from './assetUploads.ts'

export interface CreateAssetsOptions {
  // The adapter of the API, such as `createMikroAdapter(orm)`.
  adapter: MikroAdapter
  fields: AssetField[]
  storages: StorageRegistry
  // The `deleteUnusedAfter` of `runJobs()`, in milliseconds or as a duration
  // such as `'24h'`, unless a call passes its own. By default, `false` skips
  // the release.
  deleteUnusedAfter?: number | string | false
  // The `maxSize` of the asset fields and uploads without their own, as in
  // `AssetUpload`.
  maxSize?: number | string
}

export interface DefineUploadsOptions {
  // Uploads of fields that no asset field describes, with globs as `dataPath`.
  uploads?: AssetUpload[]
}

export function createAssets({
  adapter,
  fields,
  storages,
  deleteUnusedAfter = false,
  maxSize
}: CreateAssetsOptions) {
  // Throw for unknown storages and invalid values here, not in the requests:
  for (const field of fields) storages.get(field.storage)
  const defaultDeleteUnusedAfter = parseDeleteUnusedAfter(deleteUnusedAfter)
  const defaultMaxSize = parseMaxSize(maxSize)
  const normalizedFields = normalizeAssetFields(fields, defaultMaxSize)
  // Writes and uploads use the Kysely of the request, so that the `asset` rows
  // of a write commit with its transaction. The other methods run outside of
  // the requests' transactions.
  const { getKysely } = adapter
  const fieldsByEntity = Map.groupBy(normalizedFields, field => field.entity)
  const uploadsByEntity = new Map<object, NormalizedAssetUpload[]>()
  for (const [entity, fields] of fieldsByEntity) {
    if (entity) {
      uploadsByEntity.set(
        entity,
        fields.map(({ column, dataPath, storage, maxSize }) => ({
          dataPath: getDataPath(column, dataPath),
          storage,
          maxSize
        }))
      )
    }
  }
  function hasFiles(meta: EntityMetadata, visited = new Set()): boolean {
    visited.add(meta)
    return (
      fieldsByEntity.has(meta.class) ||
      meta.relations.some(
        ({ orphanRemoval, targetMeta }) => (
          orphanRemoval &&
          !visited.has(targetMeta) &&
          hasFiles(targetMeta!, visited)
        )
      )
    )
  }
  // All model controllers of the entities track the files of their writes, and
  // so do those of the entities that own rows with files:
  for (const meta of adapter.getEm().getMetadata().getAll().values()) {
    if (hasFiles(meta)) {
      adapter.wrapEntity(
        meta.class,
        defineAssetWrites({ meta, fieldsByEntity, storages, getKysely })
      )
    }
  }

  return {
    fields,
    storages,

    // Define the upload action of the asset fields of the controller's entity,
    // with the camelCase column followed by the data path of each, such as
    // `pages/*/images`, and of `uploads`.
    defineUploads({
      uploads = []
    }: DefineUploadsOptions = {}): MixinDefinition {
      for (const upload of uploads) storages.get(upload.storage)
      return defineAssetUploads({
        uploads: uploads.map(upload => ({
          ...upload,
          maxSize: parseMaxSize(upload.maxSize) ?? defaultMaxSize
        })),
        uploadsByEntity,
        storages,
        getKysely
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
        fields: normalizedFields,
        storages,
        database: adapter.getKysely()
      })
    },

    // Read in the transaction of the running request, if there is one:
    findReferences(
      options: Omit<FindAssetReferencesOptions, 'database' | 'fields'> = {}
    ) {
      return findAssetReferences({
        ...options,
        database: adapter.getKysely(tryGetContext()),
        fields
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
        fields,
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
