### New

- **server:** Storages have a `public` option. Storages with `url` are public
  by default, and `public: false` keeps their files without `url`. See
  [Storages](docs/guide/server/storages.md#storages).

### Behaviour changes

- **server:** Files get the `url` of their storage on each read, and are stored
  without `url` and `signature`, so changing a storage's `url` needs no change
  of the data.
  - Stored urls are ignored. Apps can remove them, but don't need to.
  - Code that reads file JSON straight from the database finds no `url` in
    rows written since.
  - Custom storages that build urls without `url` need `public: true`.
