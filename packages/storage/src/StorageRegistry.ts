import path from 'node:path'
import type { Storage } from './Storage.ts'
import { DiskStorage, type DiskStorageOptions } from './DiskStorage.ts'
import { S3Storage, type S3StorageOptions } from './S3Storage.ts'

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

  // Throw for unknown names:
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
  definition: StorageDefinition,
  basePath: string
): Storage {
  const { type } = definition
  switch (type) {
    case 'disk':
      return new DiskStorage({
        ...definition,
        name,
        // A missing path is left to the storage, which throws.
        path: definition.path && path.resolve(basePath, definition.path)
      })
    case 's3':
      return new S3Storage({ ...definition, name })
    default:
      throw new Error(`Unknown type '${type}' of storage '${name}'`)
  }
}
