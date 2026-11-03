// tests/utils/entities.ts
import { defineEntity, p } from '@mikro-orm/core'
import type { AssetFileObject } from '@ditojs/storage'

// The tables that `@ditojs/auth` and `@ditojs/storage` read and write through
// Kysely, as entities, so that the schema generator creates them for the
// scenarios. Their columns are snake case, as MikroORM names them.

// The `session` table of `createSessions()`.
const SessionSchema = defineEntity({
  name: 'Session',
  properties: {
    id: p.string().primary(),
    value: p.json<object>(),
    expiresAt: p.datetime().nullable()
  }
})
export class Session extends SessionSchema.class {}
SessionSchema.setClass(Session)

// The `credential` table of `createCredentials()`.
const CredentialSchema = defineEntity({
  name: 'Credential',
  uniques: [{ properties: ['userModel', 'key'] }],
  properties: {
    id: p.integer().primary(),
    type: p.string(),
    userModel: p.string(),
    userId: p.string(),
    key: p.string().nullable(),
    name: p.string().nullable(),
    data: p.json<object>().nullable(),
    createdAt: p.datetime().nullable(),
    lastUsedAt: p.datetime().nullable()
  }
})
export class Credential extends CredentialSchema.class {}
CredentialSchema.setClass(Credential)

// The `asset` table of the stored files.
const AssetSchema = defineEntity({
  name: 'Asset',
  properties: {
    id: p.integer().primary(),
    key: p.string().unique(),
    file: p.json<AssetFileObject>(),
    storage: p.string(),
    unreferencedSince: p.datetime().nullable(),
    createdAt: p.datetime().nullable(),
    updatedAt: p.datetime().nullable()
  }
})
export class Asset extends AssetSchema.class {}
AssetSchema.setClass(Asset)
