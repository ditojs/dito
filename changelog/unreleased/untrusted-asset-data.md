### Behaviour changes

- **server:** Asset signatures cover the files' metadata, so admin pages that were open during the update need a reload before saving their files again.

### Fixes

- **server:** Asset files sent by clients can't carry `data` anymore. Before, a client that had seen the signed file of another record could overwrite its stored content by sending it back with `data`.
- **server:** Asset files sent by clients can't change their `url`, `name`, `type`, `size` or dimensions either: their signatures cover them.
