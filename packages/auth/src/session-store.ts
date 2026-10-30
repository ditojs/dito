import type { Kysely } from 'kysely'
import { isNumber, isString } from '@ditojs/utils'
import type { AnyContext, Database, SessionValue } from './types.ts'

// Sessions in Dito 6's `session` table: `id`, `value` as JSON, and
// `expires_at`, from the `_expire` that koa-session writes into the value.
// Values are written as JSON strings and dates as ISO strings, which Postgres
// casts and SQLite keeps as text.

export interface SessionStore {
  get(c: AnyContext, id: string): Promise<SessionValue | null>
  set(c: AnyContext, id: string, value: SessionValue): Promise<void>
  destroy(c: AnyContext, id: string): Promise<void>
}

export function createSessionStore(
  db: Database,
  table = 'session'
): SessionStore {
  return {
    async get(c, id) {
      const row = await db(c)
        .selectFrom(table)
        .select('value')
        .where('id', '=', id)
        .executeTakeFirst()
      return row ? parseJson(row.value) : null
    },

    async set(c, id, value) {
      const { _expire } = value
      const values = {
        value: JSON.stringify(value),
        expires_at: isNumber(_expire) ? new Date(_expire).toISOString() : null
      }
      await db(c)
        .insertInto(table)
        .values({ id, ...values })
        .onConflict(conflict => conflict.column('id').doUpdateSet(values))
        .execute()
    },

    async destroy(c, id) {
      await db(c).deleteFrom(table).where('id', '=', id).execute()
    }
  }
}

// Deletes the sessions that expired, as Dito 6 did on an interval.
export async function deleteExpiredSessions(
  db: Kysely<any>,
  table = 'session'
) {
  await db
    .deleteFrom(table)
    .where('expires_at', '<', new Date().toISOString())
    .execute()
}

export function parseJson(value: unknown) {
  return isString(value) ? JSON.parse(value as string) : value
}
