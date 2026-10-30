import type { Kysely } from 'kysely'
import { SqliteAdapter } from 'kysely'
import { parseJson } from './session-store.ts'
import type { AnyContext, Database, UserSource } from './types.ts'

// The passkeys and TOTP secrets of users in Dito 6's `credential` table. All
// sources share the table, so rows name their users by `user_model` and
// `user_id`, a string, without foreign keys. A passkey's `key` is its
// credential id, unique per source.

export interface Credential {
  id: number
  type: string
  userModel: string
  userId: string
  key: string | null
  name: string | null
  data: any
  createdAt: Date | null
  lastUsedAt: Date | null
}

export type Credentials = ReturnType<typeof createCredentials>

export function createCredentials(db: Database, table = 'credential') {
  const query = (database: Kysely<any>, source: UserSource) =>
    database.selectFrom(table).selectAll().where('user_model', '=', source.name)

  const userId = (source: UserSource, user: unknown) =>
    String(source.describe(user).id)

  return {
    db,
    table,

    async list(
      c: AnyContext,
      source: UserSource,
      user: unknown,
      type: string
    ): Promise<Credential[]> {
      const rows = await query(db(c), source)
        .where('type', '=', type)
        .where('user_id', '=', userId(source, user))
        .orderBy('id')
        .execute()
      return rows.map(toCredential)
    },

    // With `forUpdate`, it locks the row in the transaction of `database`.
    async first(
      c: AnyContext,
      source: UserSource,
      user: unknown,
      type: string,
      { database = db(c), forUpdate = false } = {}
    ): Promise<Credential | null> {
      const row = await query(database, source)
        .where('type', '=', type)
        .where('user_id', '=', userId(source, user))
        .orderBy('id')
        .$if(forUpdate && supportsForUpdate(database), qb => qb.forUpdate())
        .executeTakeFirst()
      return row ? toCredential(row) : null
    },

    async findByKey(
      c: AnyContext,
      source: UserSource,
      type: string,
      key: string
    ): Promise<Credential | null> {
      const row = await query(db(c), source)
        .where('type', '=', type)
        .where('key', '=', key)
        .executeTakeFirst()
      return row ? toCredential(row) : null
    },

    async insert(
      c: AnyContext,
      source: UserSource,
      user: unknown,
      type: string,
      {
        key = null,
        name = null,
        data
      }: Pick<Credential, 'data'> & Partial<Pick<Credential, 'key' | 'name'>>
    ): Promise<Credential> {
      const createdAt = new Date()
      const { id } = await db(c)
        .insertInto(table)
        .values({
          type,
          user_model: source.name,
          user_id: userId(source, user),
          key,
          name,
          data: JSON.stringify(data),
          created_at: createdAt.toISOString()
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      return {
        id: Number(id),
        type,
        userModel: source.name,
        userId: userId(source, user),
        key,
        name,
        data,
        createdAt,
        lastUsedAt: null
      }
    },

    async update(
      c: AnyContext,
      id: number,
      { data, lastUsedAt }: { data?: unknown; lastUsedAt?: Date },
      database = db(c)
    ) {
      await database
        .updateTable(table)
        .set({
          ...(data !== undefined && { data: JSON.stringify(data) }),
          ...(lastUsedAt && { last_used_at: lastUsedAt.toISOString() })
        })
        .where('id', '=', id)
        .execute()
    },

    // Deletes the user's credentials of `type`, or only the one with `id`.
    // Resolves to the number of deleted rows.
    async remove(
      c: AnyContext,
      source: UserSource,
      user: unknown,
      type: string,
      id?: number
    ) {
      const result = await db(c)
        .deleteFrom(table)
        .where('user_model', '=', source.name)
        .where('user_id', '=', userId(source, user))
        .where('type', '=', type)
        .$if(id !== undefined, qb => qb.where('id', '=', id!))
        .executeTakeFirst()
      return Number(result.numDeletedRows)
    },

    // Deletes all credentials of users, which the app calls when it deletes
    // them, as nothing deletes them through foreign keys.
    async removeUsers(c: AnyContext, source: UserSource, ids: unknown[]) {
      if (ids.length === 0) return
      await db(c)
        .deleteFrom(table)
        .where('user_model', '=', source.name)
        .where('user_id', 'in', ids.map(String))
        .execute()
    }
  }
}

function toCredential(row: any): Credential {
  return {
    id: Number(row.id),
    type: row.type,
    userModel: row.user_model,
    userId: row.user_id,
    key: row.key,
    name: row.name,
    data: parseJson(row.data),
    createdAt: toDate(row.created_at),
    lastUsedAt: toDate(row.last_used_at)
  }
}

function toDate(value: unknown) {
  return value == null ? null : new Date(value as string)
}

// SQLite locks the whole database for writes and knows no `FOR UPDATE`.
function supportsForUpdate(db: Kysely<any>) {
  return !(db.getExecutor().adapter instanceof SqliteAdapter)
}
