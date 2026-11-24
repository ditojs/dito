### New

- **server:** `maxSize` in the asset settings of models, e.g.
  `{ storage: 'covers', maxSize: '10MB' }`, limits the size of files that
  writes import from `allowedImports` URLs or copy from other storages.
- **utils:** `parseFileSize()` and `formatFileSize()` read and format file
  sizes with units, e.g. `'10MB'`.
