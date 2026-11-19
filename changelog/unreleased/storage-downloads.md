### New

- **server:** Controllers with `downloads = true` serve the files of their
  members at `GET :id/download/:key`, with the `authorize` of member `get`.
  Member actions on `download/:param` throw at setup. See
  [Downloads](docs/guide/server/storages.md#downloads).
- **admin:** The `upload` type's `downloadUrl: true` links files without `url`
  to the download route of the form's member.
