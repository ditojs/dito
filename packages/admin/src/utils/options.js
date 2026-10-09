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
  'defaultMultiple',
  'defaultWidth',
  'getSourceType',
  'generateLabel',
  'rendersOwnLabel',
  'excludeValue',
  'ignoreMissingValue',
  'treatNullAsMissing',
  'valueFromDataSchema',
  'omitSpacing',
  'processValue',
  'getTypeValidations',
  'processSchema',
  'getPanelSchema',
  'getFormSchemasForProcessing',
  // vue-router reads route guards from the raw component options, without
  // their mixins, see `extractComponentsGuards()` in its `navigationGuards.ts`.
  'beforeRouteUpdate',
  'beforeRouteLeave'
]
