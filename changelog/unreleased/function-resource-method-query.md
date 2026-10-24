### Fixes

- **admin:** Resources given as functions send the `method` and `query` they return. Before, requests ignored them and used `GET` without a query.
