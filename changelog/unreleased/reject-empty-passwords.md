### Behaviour changes

- **server:** `UserMixin` rejects empty passwords with a validation error, instead of setting the hash of `''`. Models that declare the password property with their own `minLength` keep theirs.
