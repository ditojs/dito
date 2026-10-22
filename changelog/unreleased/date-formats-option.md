### Behaviour changes

- **admin:** `format` of `color` fields is renamed to `colorFormat`, and `format` of `date`, `datetime` and `time` fields to `formats`, the same shape as `api.formats` that it merges over, so that `format` only means the data format, as on the server. The old keys are ignored.
