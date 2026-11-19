### Behaviour changes

- **server:** Assets track their use with `unreferencedSince` instead of `count`. Writes that store files lock their assets and clear it, and [`app.releaseUnusedAssets()`](../../docs/api/server/application.md#releaseunusedassets) first scans all data to set it on the assets that no data references, so writes that skip the model hooks or fail can't leave wrong counts. Add the `unreferenced_since` column to the asset table and run `db:scan_assets` once, see [The asset model](../../docs/guide/server/storages.md#the-asset-model). `count` stays in `AssetMixin` for one more release, unused: drop the column in a migration of your own.
- **server:** Unused assets are removed `deleteUnusedAfter` after the scan that finds them unreferenced, and each run of the release reads all data with asset properties. Only writes in transactions keep their files from being removed until they commit.
- **server:** Saves fail for files without an asset record also when the file was already stored in the record. The scan creates the missing records, also of files that their storage lost.
- **server:** [`app.scanAssets()`](../../docs/api/server/application.md#scanassets) and `db:scan_assets` replace `app.recountAssets()` and `db:recount_assets`, and return `{ referenced, unreferenced, missing, lost }`.
- **server:** [`app.referenceAssets(files, transaction)`](../../docs/api/server/application.md#referenceassets) replaces `app.handleAddedAndRemovedAssets()`, and the third argument of `app.createAssets()` is `referenced` instead of `count`: counts above `0` mark the assets as referenced.

### New

- **server:** [`app.findOrphanedFiles()`](../../docs/api/server/application.md#findorphanedfiles) and `db:find_orphaned_files` list the files of storages that have no asset record and no reference, older than a day, and remove them with `remove: true` or `--remove`. Storages list their files with the time of their last change through [`storage.listFiles()`](../../docs/api/server/storage.md#listfiles).
