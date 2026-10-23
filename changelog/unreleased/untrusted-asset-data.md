### Fixes

- **server:** Asset files sent by clients can't carry `data` anymore. Before, a client that had seen the signed file of another record could overwrite its stored content by sending it back with `data`.
