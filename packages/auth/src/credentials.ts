import type { Kysely } from 'kysely'
import type { User, UserSource } from './types.ts'

// The passkeys and TOTP secrets of users in the `credential` table, with `data`
// as JSON. All sources share the table, so rows name their users by
// `user_model` and `user_id`, a string, without foreign keys. A passkey's `key`
// is its credential id, unique per source.

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

// `db` returns the root Kysely instance. Credentials don't use the request's
// transaction, so TOTP failures stay counted when the request fails.
export function createCredentials(db: () => Kysely<any>) {
  const query = (
    database: Kysely<any>,
    source: UserSource<any>,
    type: string
  ) =>
    database
      .selectFrom('credential')
      .selectAll()
      .where('user_model', '=', source.name)
      .where('type', '=', type)

  return {
    db,

    async list(
      source: UserSource<any>,
      user: User,
      type: string
    ): Promise<Credential[]> {
      const rows = await query(db(), source, type)
        .where('user_id', '=', String(user.id))
        .orderBy('id')
        .execute()
      return rows.map(toCredential)
    },

    // With `trx`, it locks the row in that transaction.
    async findFirst(
      source: UserSource<any>,
      user: User,
      type: string,
      trx?: Kysely<any>
    ): Promise<Credential | null> {
      const row = await query(trx ?? db(), source, type)
        .where('user_id', '=', String(user.id))
        .orderBy('id')
        .$if(!!trx, qb => qb.forUpdate())
        .executeTakeFirst()
      return row ? toCredential(row) : null
    },

    async findByKey(
      source: UserSource<any>,
      type: string,
      key: string
    ): Promise<Credential | null> {
      const row = await query(db(), source, type)
        .where('key', '=', key)
        .executeTakeFirst()
      return row ? toCredential(row) : null
    },

    async insert(
      source: UserSource<any>,
      user: User,
      type: string,
      {
        key = null,
        name = null,
        data
      }: Pick<Credential, 'data'> & Partial<Pick<Credential, 'key' | 'name'>>
    ): Promise<Credential> {
      const row = await db()
        .insertInto('credential')
        .values({
          type,
          user_model: source.name,
          user_id: String(user.id),
          key,
          name,
          data: JSON.stringify(data),
          created_at: new Date()
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      return toCredential(row)
    },

    async update(
      id: number,
      { data, lastUsedAt }: { data: unknown; lastUsedAt?: Date },
      trx = db()
    ) {
      await trx
        .updateTable('credential')
        .set({
          data: JSON.stringify(data),
          ...(lastUsedAt && { last_used_at: lastUsedAt })
        })
        .where('id', '=', id)
        .execute()
    },

    // Deletes the user's credentials of `type`, or only the one with `id`.
    // Resolves to the number of deleted rows.
    async delete(
      source: UserSource<any>,
      user: User,
      type: string,
      id?: number
    ) {
      const result = await db()
        .deleteFrom('credential')
        .where('user_model', '=', source.name)
        .where('user_id', '=', String(user.id))
        .where('type', '=', type)
        .$if(id !== undefined, qb => qb.where('id', '=', id!))
        .executeTakeFirst()
      return Number(result.numDeletedRows)
    }
  }
}

// Deletes the credentials of the users with `ids`. The app calls it when it
// deletes users, as no foreign keys do.
export async function deleteUserCredentials(
  db: Kysely<any>,
  source: UserSource<any>,
  ids: unknown[]
) {
  if (ids.length === 0) return
  await db
    .deleteFrom('credential')
    .where('user_model', '=', source.name)
    .where('user_id', 'in', ids.map(String))
    .execute()
}

function toCredential(row: any): Credential {
  return {
    id: row.id,
    type: row.type,
    userModel: row.user_model,
    userId: row.user_id,
    key: row.key,
    name: row.name,
    data: row.data,
    createdAt: toDate(row.created_at),
    lastUsedAt: toDate(row.last_used_at)
  }
}

// MikroORM's pool reads timestamps as strings.
function toDate(value: unknown) {
  return value == null ? null : new Date(value as string)
}
