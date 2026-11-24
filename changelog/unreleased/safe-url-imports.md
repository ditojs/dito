### Fixes

- **server:** Imports of files from `allowedImports` URLs no longer follow
  redirects, which could leave the allowed sources, reject error responses
  instead of storing them as the file, and give up after 30 seconds.
