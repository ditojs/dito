### New

- **storage:** `store()` and `addFile()` of storages take the data as a buffer or a stream. `S3Storage` uploads files over 8 MB in parts of 8 MB. The type and the dimensions are read from the first 8 MB, so videos larger than that with their index at the end get no width and height.
