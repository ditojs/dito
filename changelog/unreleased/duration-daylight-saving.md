### Fixes

- **server:** `releaseUnusedAssets()` measures `deleteUnusedAfter` and `deleteUnsavedAfter` correctly in the hour that repeats when clocks go back. Before, servers in timezones with daylight saving time released assets an hour late then.
