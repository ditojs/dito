import { isArray } from '@ditojs/utils'

export function formatQuery(query) {
  const entries = query
    ? isArray(query)
      ? query
      : Object.entries(query)
    : []
  return (
    new URLSearchParams(
      // Expand array values into multiple entries under the same key:
      entries.reduce(
        (entries, [key, value]) => {
          if (isArray(value)) {
            for (const val of value) {
              // Keep null values in arrays, but not as strings:
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
      // Decode these characters, like vue-router's own query encoding:
      .replaceAll(/%(?:21|24|28|29|2C|2F|3A|3B|3D|3F|40)/g, decodeURIComponent)
  )
}

// Compare whole path segments, so `/items-archive` isn't within `/items`:
export function isPathWithin(path, basePath) {
  const prefix = basePath.endsWith('/') ? basePath : `${basePath}/`
  return path === basePath || path.startsWith(prefix)
}

// Resolve to whether the navigation happened, as guards may cancel it, e.g. the
// leave guard of a form:
export function navigate(router, location) {
  return router.push(location).then(failure => !failure)
}
