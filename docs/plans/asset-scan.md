# Assets by scan

`@ditojs/storage` tracks which stored files are in use by scanning the data,
not by counting on each write. It works the same with Objection and MikroORM,
because it reads and writes through Kysely and doesn't use model hooks.

## Why

Dito 6 changes `asset.count` from model hooks on every insert, update and
delete. The hooks are hidden, tied to Objection, and they miss writes: on
Lineto's production snapshot of 2026-10-19, 109 of 7,575 counts are wrong, and
15 files have counts of 1 to 4 while nothing references them. Dito 6 already
has `recountAssets` to repair such counts.

A full scan of Lineto's data reads 260,099 rows in about one second and finds
every reference at a declared path. No column outside the declared paths holds
asset keys or asset URLs.

## Parts

1. **Asset paths per table.** One list in the app, as plain data:
   `{ table, column, path, storage }`, with Dito 6's `*` and `**` wildcards.
   It replaces `static assets` on the models, and the scan job and the write
   feature both read it.

2. **The scan job:** `scanAssets({ db, paths, storages })`.
   - It selects only the asset columns of each table and walks the paths in
     JS, with Dito 6's path matching.
   - `asset.count` is the number of rows that reference the file. A file used
     twice in one row counts once.
   - It sets `count` and `unreferenced_since` in one transaction: a file whose
     count drops to 0 gets `unreferenced_since = now()`, and a file in use
     again gets `null`.
   - `dryRun: true` only reports the changes. The first run on a database
     must be a dry run: on Lineto it releases the 15 files with wrong counts.
   - It can run nightly and on demand from the admin.

3. **Deleting, in a second phase:** `releaseAssets({ db, storages, after })`.
   - It deletes the files and `asset` rows whose `unreferenced_since` is
     older than `after` and that are still unreferenced at a later scan. This
     guards against a save that attaches an old unused file again while the
     scan runs.
   - Uploads that are never saved get `count = 0` and `unreferenced_since`
     set when inserted, so the same phase removes them.
   - It lists the live storage to find files without an `asset` row, with
     both the flat and the nested `a/b/key` folder layouts that exist on disk.

4. **Writes:** an `assets(paths)` feature for controllers.
   - It checks the signatures of incoming file objects and imports files from
     other storages or allowed URLs, as the Dito 6 hooks do.
   - A file object in the body clears `unreferenced_since` of its asset, so a
     reattached file isn't deleted.
   - After `next()` it checks `c.error` and removes imported files again when
     the write failed.
   - Uploads insert the `asset` row through `uploadHandler`'s `onUpload`, in
     the request's transaction.

5. **Usage of one file:** `findAssetUsage({ db, paths, key })` lists the rows
   that reference a key, for the admin's asset view, so it doesn't depend on
   the last scan.

## Schema

`asset` gets `unreferenced_since timestamptz null`. Existing counts stay until
the first real scan replaces them.

## Lineto

- The asset paths of its 10 tables move from the models' `static assets` into
  one file. Without `static assets`, the Dito 6 hooks stop counting.
- Three columns are `json`, not `jsonb` (`designer.images`,
  `shop_order.custom_font_file`, `shop_order.custom_license_document`). The
  scan reads them as they are; SQL filters on them need casts.
- `story` and `specimen_template` declare root `**` paths, which match any
  `file`, `files` or `backgroundImage` key in those tables. Nothing wrong
  matches today. Narrowing them to real paths is safer.
- `shop_order` holds 259,006 of the rows read and most of the scan time.

## Open

- Where the job runs in Lineto: a nightly script, the admin, or both.
- How long `after` is. Lineto deletes after `12h` today (`deleteUnusedAfter`
  and `deleteUnsavedAfter` in `backend/config/config.js`) and never on the
  lab. With a nightly scan, a file is deleted one or two scans after it
  became unused.
