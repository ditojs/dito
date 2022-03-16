<template lang="pug">
  component(
    :is="component"
    v-bind="$props"
  )
</template>

<script>
// This is the general purpose 'component' type, which can resolve to any custom
// component through `schema.component`, see `resolveTypeComponent()`. This can
// be used to nest arbitrary vue components in schema:
// {
//   type: 'component',
//   component: import('./component')
// }

import TypeComponent from '../TypeComponent.js'

// @vue/component
export default TypeComponent.register('component', {
  // Override the standard `defaultValue: null` to not set any data for custom
  // components, unless they provide a default value.
  defaultValue: () => undefined, // Callback to override `defaultValue: null`
  ignoreMissingValue: schema => !('default' in schema)
})
</script>
