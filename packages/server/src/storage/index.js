import { Storage } from './Storage'
import { LocalStorage } from './LocalStorage'
import { S3Storage } from './S3Storage'

Storage.register(LocalStorage)
Storage.register(S3Storage)

export { Storage }
