// A mini-replication of vue's internal `resolveMergedOptions()` but only
// handling our own added options properties and merging them early instead
// of lazily.

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
  for (const key of ditoOptionKeys) {
    if (key in from) {
      to[key] = from[key]
    }
  }
  return to
}

const ditoOptionKeys = [
  'defaultValue',
  'defaultNested',
  'defaultVisible',
  'generateLabel',
  'excludeValue',
  'ignoreMissingValue',
  'alignBottom',
  'omitPadding',
  'processValue',
  'processSchema',
  'getPanelSchema',
  'getFormSchemasForProcessing',
  // Vue 3 / Vue-router 4 forgets these.
  // TODO: Create bug-report?
  'beforeRouteUpdate',
  'beforeRouteLeave'
]
