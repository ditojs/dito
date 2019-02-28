import { Storage } from './Storage'
import { DiskStorage } from './DiskStorage'
import { S3Storage } from './S3Storage'

Storage.register(DiskStorage)
Storage.register(S3Storage)

export { Storage }
