### New

- **storage:** `maxSize` on asset paths, uploads and `createAssets()` limits the size of uploads in bytes, and answers larger ones with 413 before reading them whole. It replaces the `limits` of Dito.js 6's uploads. See [Uploads](docs/api/server/storage.md#uploads).
