### Behaviour changes

- **server:** Errors that aren't `ResponseError`s, e.g. a plain `Error` thrown in an action, respond with "An error has occurred." instead of their message, unless they have `expose: true` or a status below 500, or `config.env` is `'development'`. Their message still goes to the log and the `'error'` events. Apps throw `ResponseError`s for messages meant for clients, see [Plain errors](docs/guide/server/errors.md#plain-errors).
- **server:** Actions and model queries no longer wrap other errors in `ResponseError`s, and pass them on as they are: plain errors with a status below 500 respond with only their `message`, without `code` or other data, and `'error'` listeners receive the raw error, which often has no `status`.
- **server:** `DatabaseError`s with status 500 or higher respond with "An error has occurred." instead of the database's message, through `expose: false`, which `ResponseError`s take as an option.
- **server:** Logins that fail with other errors than `ResponseError`s below 500, e.g. a plain `Error` in a `before:login` hook, respond with their own status or 500 like other actions, instead of 401 and the login response with their message.
- **server:** Uploads beyond multer's `limits` respond with status 413 for `fileSize` and 400 for the others, with multer's message and `code`, instead of status 500.
- **server:** Errors are logged by their status alone, at level `info` below 500, also when they aren't `ResponseError`s, e.g. of invalid JSON bodies, and errors with `expose: true` are logged too.
