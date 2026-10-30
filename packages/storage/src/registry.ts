import path from 'node:path'
import { isPlainObject } from '@ditojs/utils'
import type { Storage } from './storage.ts'
import { DiskStorage, type DiskStorageOptions } from './disk-storage.ts'
import { S3Storage, type S3StorageOptions } from './s3-storage.ts'

// The storages of an app by name. `createStorages()` builds them from plain
// definitions, such as the `storages` of an app's config. The functions of
// this package that look up storages by name take a registry or a plain
// object of storages.

type Definition<T> = Omit<T, 'name' | 'secret'> & {
  secret?: string | Buffer
}

export type StorageDefinition =
  | ({ type: 'disk' } & Definition<DiskStorageOptions>)
  | ({ type: 's3' } & Definition<S3StorageOptions>)

export interface CreateStoragesOptions {
  // The secret of the file signatures, unless a definition sets its own.
  secret?: string | Buffer
  // The folder that the `path` of disk storages is resolved against. It
  // defaults to the working directory.
  basePath?: string
}

export class StorageRegistry implements Iterable<[string, Storage]> {
  #storages: Map<string, Storage>

  constructor(storages: Iterable<Storage> | Record<string, Storage> = []) {
    this.#storages = new Map(
      isPlainObject(storages)
        ? Object.entries(storages as Record<string, Storage>)
        : [...(storages as Iterable<Storage>)].map(storage => [
            storage.name,
            storage
          ])
    )
  }

  // Throws for unknown names.
  get(name: string): Storage {
    const storage = this.#storages.get(name)
    if (!storage) throw new Error(`Unknown storage '${name}'`)
    return storage
  }

  has(name: string) {
    return this.#storages.has(name)
  }

  get names() {
    return [...this.#storages.keys()]
  }

  values() {
    return this.#storages.values()
  }

  [Symbol.iterator]() {
    return this.#storages.entries()
  }
}

export type Storages = StorageRegistry | Record<string, Storage>

export function createStorages(
  definitions: Record<string, StorageDefinition>,
  { secret, basePath = process.cwd() }: CreateStoragesOptions = {}
) {
  return new StorageRegistry(
    Object.entries(definitions).map(([name, definition]) =>
      createStorage(name, definition, { secret, basePath })
    )
  )
}

function createStorage(
  name: string,
  { type, ...options }: StorageDefinition,
  { secret, basePath }: CreateStoragesOptions & { basePath: string }
): Storage {
  const common = { secret, ...options, name }
  switch (type) {
    case 'disk': {
      const { path: folder } = options as DiskStorageOptions
      return new DiskStorage({
        ...(common as DiskStorageOptions),
        // A missing path is left to the storage, which throws.
        path: folder && path.resolve(basePath, folder)
      })
    }
    case 's3':
      return new S3Storage(common as S3StorageOptions)
    default:
      throw new Error(`Unknown type '${type}' of storage '${name}'`)
  }
}

// Returns the registry of `storages`, for the functions that take either.
export function toStorageRegistry(storages: Storages) {
  return storages instanceof StorageRegistry
    ? storages
    : new StorageRegistry(storages)
}
