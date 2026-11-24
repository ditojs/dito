### Behaviour changes

- **server:** Request logs show the path without the query string, also in the
  `req` of JSON logs, so tokens in URLs, e.g. `?token=…`, no longer reach
  the logs.
