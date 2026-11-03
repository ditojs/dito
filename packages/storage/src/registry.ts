import path from 'node:path'
import type { Storage } from './Storage.ts'
import { DiskStorage, type DiskStorageOptions } from './DiskStorage.ts'
import { S3Storage, type S3StorageOptions } from './S3Storage.ts'

// The storages of an app by name. `createStorages()` builds them from plain
// definitions, such as the `storages` of an app's config.

export type StorageDefinition =
  | ({ type: 'disk' } & Omit<DiskStorageOptions, 'name'>)
  | ({ type: 's3' } & Omit<S3StorageOptions, 'name'>)

export interface CreateStoragesOptions {
  // The folder that the `path` of disk storages resolves against. Default: the
  // working directory.
  basePath?: string
}

export class StorageRegistry extends Map<string, Storage> {
  constructor(storages: Iterable<Storage> = []) {
    super([...storages].map(storage => [storage.name, storage]))
  }

  // Throws for unknown names.
  override get(name: string): Storage {
    const storage = super.get(name)
    if (!storage) throw new Error(`Unknown storage '${name}'`)
    return storage
  }
}

export function createStorages(
  definitions: Record<string, StorageDefinition>,
  { basePath = process.cwd() }: CreateStoragesOptions = {}
) {
  return new StorageRegistry(
    Object.entries(definitions).map(([name, definition]) =>
      createStorage(name, definition, basePath)
    )
  )
}

function createStorage(
  name: string,
  { type, ...options }: StorageDefinition,
  basePath: string
): Storage {
  switch (type) {
    case 'disk': {
      const { path: folder } = options as DiskStorageOptions
      return new DiskStorage({
        ...(options as DiskStorageOptions),
        name,
        // A missing path is left to the storage, which throws.
        path: folder && path.resolve(basePath, folder)
      })
    }
    case 's3':
      return new S3Storage({ ...(options as S3StorageOptions), name })
    default:
      throw new Error(`Unknown type '${type}' of storage '${name}'`)
  }
}
