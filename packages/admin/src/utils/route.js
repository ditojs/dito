import { isArray } from '@ditojs/utils'

export function formatQuery(query) {
  const entries = query
    ? isArray(query)
      ? query
      : Object.entries(query)
    : []
  return (
    new URLSearchParams(
      // Expand array values into multiple entries under the same key, so
      // `formatQuery({ foo: [1, 2], bar: 3 })` => 'foo=1&foo=2&bar=3'.
      entries.reduce(
        (entries, [key, value]) => {
          if (isArray(value)) {
            for (const val of value) {
              // Prevent null or undefined values from becoming strings,
              // but since they're entries in an array, we still include them.
              entries.push([key, val ?? ''])
            }
          } else if (value != null) {
            entries.push([key, value])
          }
          return entries
        },
        []
      )
    )
      .toString()
      // decode all these encoded characters to have the same behavior as
      // vue-router's own query encoding.
      .replaceAll(/%(?:21|24|28|29|2C|2F|3A|3B|3D|3F|40)/g, decodeURIComponent)
  )
}

// Returns true if `path` is `basePath` or one of its sub-paths, comparing
// whole path segments, so that `/items/12` and `/items-archive` aren't within
// `/items/1` and `/items`.
export function isPathWithin(path, basePath) {
  const prefix = basePath.endsWith('/') ? basePath : `${basePath}/`
  return path === basePath || path.startsWith(prefix)
}
