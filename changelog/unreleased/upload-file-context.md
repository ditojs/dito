### Fixes

- **admin:** Uploads with `multiple` call `downloadUrl()` and `thumbnailUrl()` with the context of each file, with the file as `value` and its index as `valueIndex`. Before, they received the context of the field, so the links of multiple uploads couldn't tell their files apart.
