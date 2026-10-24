### Behaviour changes

- **server:** S3 storages need `@aws-sdk/lib-storage`, a new optional peer dependency, next to `@aws-sdk/client-s3` to write files themselves, e.g. imported or copied ones.

### Fixes

- **server:** Files that an S3 storage without `url` writes itself, e.g. imported or copied ones, get the S3 url as uploaded files do.
