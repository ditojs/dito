import BetterSQLite3Client from 'knex/lib/dialects/better-sqlite3/index.js'

// Work around two issues of knex's better-sqlite3 client:
export class SQLiteClient extends BetterSQLite3Client {
  // SQLite stores dates as ISO strings, see `Model.$formatDatabaseJson()`, but
  // knex binds `Date` objects as numbers. Bind them as ISO strings too, so
  // queries can compare them:
  _formatBindings(bindings) {
    return super._formatBindings(
      bindings?.map(binding =>
        binding instanceof Date ? binding.toISOString() : binding
      )
    )
  }

  // SQLite keeps a transaction open when its COMMIT fails, e.g. on a deferred
  // constraint, but knex doesn't roll it back. No knex transaction holds a
  // connection that the pool hands out, so an open transaction is such a
  // leftover.
  // TODO: Remove once https://github.com/knex/knex/pull/6545 is released.
  async acquireConnection() {
    const connection = await super.acquireConnection()
    if (connection.inTransaction) {
      connection.exec('ROLLBACK')
    }
    return connection
  }
}
