<template lang="pug">
  .dito-panel-anchor(
    :id="dataPath"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

// @vue/component
export default TypeComponent.register('panel', {
  renderLabel: false,
  containerClass: 'no-padding',

  getPanelSchema(schema) {
    // For a TypePanel, the component schema is also the panel schema:
    return schema
  }
})
</script>
