### Fixes

- **server:** `readDimensions` stops reading after the first 8 MB of an upload
  without dimensions, instead of buffering and parsing the whole file. The
  upload is stored without dimensions.
