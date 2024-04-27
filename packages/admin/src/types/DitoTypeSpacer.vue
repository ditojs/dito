<!-- eslint-disable vue/valid-template-root -->
<template lang="pug"></template>
<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
// @vue/component
export default DitoTypeComponent.register('spacer', {
  defaultValue: () => undefined, // Callback to override `defaultValue: null`
  excludeValue: true,
  generateLabel: false
})
</script>
