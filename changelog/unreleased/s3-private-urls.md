### Behaviour changes

- **server:** S3 storages give files a `url` only if they set `url`, as before 6.0.0, so files of private buckets have no URL that can't be opened. The admin downloads them from the upload schema's [`downloadUrl`](../../docs/api/admin/schemas.md#upload). Give public S3 storages without `url` the URL of their bucket, e.g. `url: 'https://bookshop-covers.s3.eu-central-1.amazonaws.com/'`. Files stored since 6.0.0 in private buckets keep their URL in the database: remove `url` from their JSON.
