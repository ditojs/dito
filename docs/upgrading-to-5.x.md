# Upgrading to Dito.js 5.x

This guide describes how to upgrade an app from Dito.js 4.x to 5.x.
[`CHANGELOG.md`](../CHANGELOG.md) lists all changes.

## Server

### Expired records

Once started with `app.start()`, the application deletes expired records every
hour, first one hour after the start, through
[`app.deleteExpiredRecords()`](api/server/application.md#deleteexpiredrecords),
which calls [`deleteExpiredRecords()`](api/server/model.md#static-deleteexpiredrecords)
on every model. `config.app.deleteExpiredRecordsEvery` changes the interval,
`false` turns it off. Apps that don't call `app.start()`, e.g. with their own
HTTP server through `app.callback()`, or that only run briefly, call
`app.deleteExpiredRecords()` themselves or run `dito db:delete_expired_records`
on a schedule, e.g. from cron.

### Sessions

Session models built on [`SessionMixin`](api/server/model.md#sessionmixin)
store the expiry of sessions in a new `expiresAt` column, through which
expired sessions are deleted. Add it to the sessions table with a migration:

```js
export async function up(knex) {
  await knex.schema.alterTable('session', table => {
    table.timestamp('expires_at').nullable().index()
  })
  // Sessions get their expiry on their next write. On PostgreSQL, set it for
  // all of them, so that sessions that are never used again are deleted too:
  if (knex.client.dialect === 'postgresql') {
    await knex('session').update({
      expires_at: knex.raw(`to_timestamp((value->>'_expire')::bigint / 1000.0)`)
    })
  }
}

export async function down(knex) {
  await knex.schema.alterTable('session', table => {
    table.dropColumn('expires_at')
  })
}
```

### Assets

- Renamed: `config.assets.cleanupTimeThreshold` is `deleteUnusedAfter`,
  `danglingTimeThreshold` is `deleteUnsavedAfter`, and the `timeThreshold`
  option of `app.releaseUnusedAssets()` is `olderThan`. `false` keeps the
  assets. Unknown asset options and invalid durations throw on startup.
- Unused assets are released by `app.deleteExpiredRecords()`, at its first
  run after `deleteUnusedAfter`, instead of after writes of asset data. With
  `deleteUnusedAfter: 0`, they are released at the next run, up to an hour
  later, no longer right after the write. Tests that check the release call
  `app.deleteExpiredRecords()` or `app.releaseUnusedAssets()`.
- Apps that call `app.releaseUnusedAssets()` on a schedule of their own, e.g.
  from a service, can drop it.
