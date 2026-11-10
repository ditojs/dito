### New

- **server, admin:** Forms of graph controllers with `delta = true`, whose
  model has a version, save only their delta against the loaded record, so
  hooks and handlers of member patches receive only the values and rows that
  changed. Give `patch` actions whose handlers read the whole record
  `delta: false`, see [Deltas](docs/guide/server/controllers.md#deltas).
- **server:** CORS exposes the `Dito-Record-Graph` header, in addition to the
  app's `exposeHeaders`.
