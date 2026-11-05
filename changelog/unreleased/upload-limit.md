### New

- **storage:** `maxSize` on asset paths, uploads and `createAssets()` limits the size of each uploaded file in bytes, and answers larger ones with 413. It replaces the `limits` of Dito.js 6's uploads. See [Uploads](docs/api/server/storage.md#uploads).
