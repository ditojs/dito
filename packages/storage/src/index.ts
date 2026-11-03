import { Storage } from './Storage.ts'
import { DiskStorage } from './DiskStorage.ts'
import { S3Storage } from './S3Storage.ts'

Storage.register(DiskStorage)
Storage.register(S3Storage)

export * from './AssetFile.ts'
export { Storage }
