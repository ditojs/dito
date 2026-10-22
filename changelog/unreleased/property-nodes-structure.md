### Behaviour changes

- **admin:** Copies hold only the values that have a field, also in nested sections (`nested: true`): their ids now drop like those of objects and lists, so pasting creates new records instead of pointing to the copied ones.

### Fixes

- **admin:** Written `properties` handle files and display values like fields: copies to zip files include the files of `asset` values, which pasting uploads again, and item labels and table cells show dates and times in the formats of the admin.
