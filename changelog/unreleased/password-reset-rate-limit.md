### Fixes

- **server:** `'post password-reset'` sends at most one email per user and
  minute. Further requests within the minute answer the same, but send nothing.
