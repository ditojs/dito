### New

- **server, admin:** Models mark the property that holds their version with
  `version: true`. Member actions send it in the `Dito-Record-Version` header,
  forms send it back, and saves of records that changed since they were loaded
  fail with status 412, see
  [Stale saves](docs/guide/server/controllers.md#stale-saves).
- **server:** CORS exposes the `Dito-Record-Version` header, in addition to the
  app's `exposeHeaders`, and allows it if the app lists `allowHeaders`.
