### Behaviour changes

- **server:** Transacted requests don't emit `'commit'` and `'rollback'` events on `ctx.transaction` anymore. Files stored or imported before a handler rolls back without an error stay in the storage.

### Fixes

- **server:** Files stored or imported in any transaction that rolls back with an error are removed again, also in transactions of `Model.transaction()` and of Objection.js, e.g. for array inserts. Before, only transacted requests removed them.
