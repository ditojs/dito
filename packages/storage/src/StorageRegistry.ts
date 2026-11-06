import type { Storage } from './Storage.ts'
import { DiskStorage, type DiskStorageOptions } from './DiskStorage.ts'
import { S3Storage, type S3StorageOptions } from './S3Storage.ts'

export type StorageDefinition =
  | ({ type: 'disk' } & Omit<DiskStorageOptions, 'name'>)
  | ({ type: 's3' } & Omit<S3StorageOptions, 'name'>)

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

export function createStorages(definitions: Record<string, StorageDefinition>) {
  return new StorageRegistry(
    Object.entries(definitions).map(([name, definition]) =>
      createStorage(name, definition)
    )
  )
}

function createStorage(name: string, definition: StorageDefinition): Storage {
  const { type } = definition
  switch (type) {
    case 'disk':
      return new DiskStorage({ ...definition, name })
    case 's3':
      return new S3Storage({ ...definition, name })
    default:
      throw new Error(`Unknown type '${type}' of storage '${name}'`)
  }
}
