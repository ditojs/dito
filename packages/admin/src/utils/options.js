// A mini-replication of vue's internal `resolveMergedOptions()` but only
// handling the route guards, which vue-router reads from the raw component
// options, without their mixins.

export function resolveMergedOptions(options) {
  const { mixins } = options
  return mixins || options.extends
    ? mergeOptions(
        { ...options },
        options
      )
    : options
}

export function mergeOptions(to, from) {
  if (from.extends) {
    mergeOptions(to, from.extends)
  }
  if (from.mixins) {
    for (const mixin of from.mixins) {
      mergeOptions(to, mixin)
    }
  }
  for (const key of routeGuardKeys) {
    if (key in from) {
      to[key] = from[key]
    }
  }
  return to
}

const routeGuardKeys = ['beforeRouteUpdate', 'beforeRouteLeave']
