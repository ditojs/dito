### Fixes

- **server:** `insertGraph()`, `upsertGraph()`, `patchGraph()` and `updateGraph()` called without a transaction write their graph in one of their own, so failures leave nothing behind. Model hooks of these writes now run inside it.
