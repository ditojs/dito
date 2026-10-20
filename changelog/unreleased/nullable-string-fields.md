### Behaviour changes

- **admin:** Fields store no value as the empty value of their type: `text` and its variants, `textarea` and `code` send `''` instead of `null` when emptied and in new items, `markup` stores an empty editor as `''` instead of the HTML of its empty nodes, e.g. `<p></p>`, and new `checkbox` fields send `false` instead of `null`, like `switch`. Fields of server properties that are `nullable` and rely on `null`, e.g. through `whereNull()`, need `nullable: true`, and so do checkboxes whose `required` relies on `null`, as `required` accepts `false`. Clear buttons clear string fields to `''`, and don't show for `''`. Filter fields are `nullable` unless set otherwise, so filters without values still don't apply.

### New

- **admin:** `nullable` on string fields (`text` and its variants, `textarea`, `code`, `markup`) and boolean fields (`checkbox`, `switch`) stores no value as `null` instead of `''` or `false`, matching `nullable` on the server.
