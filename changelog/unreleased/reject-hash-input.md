### Fixes

- **server:** `UserMixin` rejects `hash` in all input that isn't trusted, with the 400 response that only `UsersController` answered before. Other controllers, e.g. relation controllers of user relations, and graphs of other models could set the hashes of users directly.
