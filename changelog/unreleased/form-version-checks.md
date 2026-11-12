### Behaviour changes

- **admin:** Forms of records with a version check it on edits and when the window gets the focus, at most every 30 seconds. If it changed, forms without edits load the latest record, and forms with edits offer to, see [Stale saves](docs/guide/server/controllers.md#stale-saves).

### New

- **server:** Controllers of models with a version route `GET :id/record-version`, authorized like `get`. It answers with status 204 and the version in the `Dito-Record-Version` header.
