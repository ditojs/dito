### Fixes

- **server:** `app.start()` rejects when the server can't listen, e.g. on a
  port that is taken, instead of never settling. When the start fails, it
  emits `after:stop`, so the services that started stop again.
