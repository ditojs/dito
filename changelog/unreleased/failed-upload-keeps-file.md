### Fixes

- **admin:** A failed upload in a single `upload` field keeps the file that was stored before, instead of clearing the field and removing the file on save. `onChange()` receives the uploaded file instead of its upload.
