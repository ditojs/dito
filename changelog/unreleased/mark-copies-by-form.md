### Behaviour changes

- **admin:** `DitoClipboard` takes the `name` that it marks and matches copies with instead of a `schema`.
- **admin:** Copies and downloads are marked with `$name` instead of `$schema`. Copies and downloaded files of earlier versions, and data without a mark, no longer paste.

### New

- **admin:** `clipboard.name` names the copies of a form, of a list, or of the items of a list or object, so that lists of different names can paste their items and whole lists into each other. See [Clipboard](docs/api/admin/schemas.md#clipboard) for the order of the names.

### Fixes

- **admin:** Copies of items whose form has no `name` are marked with the name of their list, and only paste into items of the same list or of lists of the same name. They used to paste into all forms without a name. Downloads of forms without a label are named after their list instead of `data`.
