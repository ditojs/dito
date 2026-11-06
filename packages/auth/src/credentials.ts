import type { Kysely } from 'kysely'
import type { Adapter } from '@ditojs/server'
import type { User, UserSource } from './users.ts'

// The passkeys and TOTP secrets of users in the `credential` table.

// All sources share the table, so rows name their users by `user_model` and
// `user_id`, a string, without foreign keys.
export interface Credential {
  id: number
  type: string
  userModel: string
  userId: string
  // A passkey's credential id, unique per source.
  key: string | null
  name: string | null
  // Stored as JSON.
  data: any
  createdAt: Date | null
  lastUsedAt: Date | null
}

export type Credentials = ReturnType<typeof createCredentials>

export interface CreateCredentialsOptions {
  // The adapter of the API, such as `createMikroAdapter(orm)`. Credentials use
  // its Kysely outside of the request's transaction, so TOTP failures stay
  // counted when the request fails.
  adapter: Adapter
}

export function createCredentials({ adapter }: CreateCredentialsOptions) {
  const { getKysely } = adapter
  const selectCredentials = (
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
    getKysely,

    async list(
      source: UserSource<any>,
      user: User,
      type: string
    ): Promise<Credential[]> {
      const rows = await selectCredentials(getKysely(), source, type)
        .where('user_id', '=', String(user.id))
        .orderBy('id')
        .execute()
      return rows.map(toCredential)
    },

    // Lock the row in the transaction `trx`, if given.
    async findFirst(
      source: UserSource<any>,
      user: User,
      type: string,
      { trx }: { trx?: Kysely<any> } = {}
    ): Promise<Credential | null> {
      const row = await selectCredentials(trx ?? getKysely(), source, type)
        .where('user_id', '=', String(user.id))
        .orderBy('id')
        .$if(!!trx, query => query.forUpdate())
        .executeTakeFirst()
      return row ? toCredential(row) : null
    },

    async findByKey(
      source: UserSource<any>,
      type: string,
      key: string
    ): Promise<Credential | null> {
      const row = await selectCredentials(getKysely(), source, type)
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
      const row = await getKysely()
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
      { trx = getKysely() }: { trx?: Kysely<any> } = {}
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

    // Delete the user's credentials of `type`, or only the one with `id`, and
    // resolve to the number of deleted rows.
    async delete(
      source: UserSource<any>,
      user: User,
      type: string,
      id?: number
    ) {
      const result = await getKysely()
        .deleteFrom('credential')
        .where('user_model', '=', source.name)
        .where('user_id', '=', String(user.id))
        .where('type', '=', type)
        .$if(id !== undefined, query => query.where('id', '=', id!))
        .executeTakeFirst()
      return Number(result.numDeletedRows)
    },

    // No foreign keys delete the credentials of deleted users.
    async deleteUser(
      source: UserSource<any>,
      user: User,
      { trx = getKysely() }: { trx?: Kysely<any> } = {}
    ) {
      await trx
        .deleteFrom('credential')
        .where('user_model', '=', source.name)
        .where('user_id', '=', String(user.id))
        .execute()
    }
  }
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
