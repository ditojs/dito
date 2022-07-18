import { Storage } from './Storage.js'
import { DiskStorage } from './DiskStorage.js'
import { S3Storage } from './S3Storage.js'

Storage.register(DiskStorage)
Storage.register(S3Storage)

export * from './AssetFile.js'
export { Storage }
