### Fixes

- **server:** `insertDitoGraph()`, `upsertDitoGraph()`, `patchDitoGraph()` and `updateDitoGraph()` called without a transaction write their graph in one of their own, so failures leave nothing behind. Model hooks of these writes now run inside it.
