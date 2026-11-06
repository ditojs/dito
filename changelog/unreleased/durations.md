### New

- **utils:** `parseDuration()` parses durations such as `'24h'`, `'1h30m'` or `'2 days'` into milliseconds. See [Dates and numbers](docs/api/utils.md#parseduration).
- **server, auth, storage:** The duration options take such strings next to milliseconds: `closeTimeout` of `serve()`, `session.maxAge` of `createUsers()`, `reconfirmAfter` and the `expiresAfter` and `resendAfter` of `passwordReset` of `users.defineActions()`, and `deleteUnusedAfter` of `createAssets()` and `runJobs()`.
