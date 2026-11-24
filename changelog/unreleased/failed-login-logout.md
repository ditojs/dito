### Fixes

- **server:** Logins that fail after the user is logged in, e.g. in an
  `after:login` hook, log the user out again, instead of answering
  `authenticated: false` while the session stays logged in.
