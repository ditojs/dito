import { isArray, asArray } from '@ditojs/utils'

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
          for (const val of asArray(value)) {
            entries.push([key, val])
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

export function replaceRoute({ path, query, hash }) {
  // Preserve `history.state`, see:
  // https://router.vuejs.org/guide/migration/#usage-of-history-state
  history.replaceState(
    history.state,
    null,
    `${
      location.origin
    }${
      path ?? location.pathname
    }?${
      query ? formatQuery(query) : location.search.slice(1)
    }${
      hash ?? location.hash
    }`
  )
}
