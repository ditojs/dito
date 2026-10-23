### Fixes

- **admin:** `notify()` turns only the newlines of text paragraphs into `<br>`, not those in the markup of `html` paragraphs, which put line breaks between the items of lists, for example.
