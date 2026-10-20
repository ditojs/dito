### Behaviour changes

- **admin:** Uploads validate `extensions` and `maxSize` also for the files in the data, not only when picking or pasting files: saving fails with "must not contain files of unsupported types: …" or "must not contain files larger than …: …" where stored files don't meet limits that were added or tightened later, or where code wrote such files. `rules: { extensions: false }` and `rules: { maxSize: false }` turn the rules off.
