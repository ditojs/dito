### New

- **server:**
  [`app.findOrphanedFiles()`](../../docs/api/server/application.md#findorphanedfiles)
  and `db:find_orphaned_files` list the files of storages that have no asset
  record and no reference, older than a day, and remove them with
  `remove: true` or `--remove`. Storages list their files with the time of
  their last change through
  [`storage.listFiles()`](../../docs/api/server/storage.md#listfiles).
