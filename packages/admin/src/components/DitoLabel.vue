<template lang="pug">
  .dito-label
    label(:for="dataPath") {{ text }}
</template>

<style lang="sass">
.dito
  .dito-label
    // In order for ellipsis to work on labels without affecting other layout,
    // we need to position it absolutely inside its container.
    margin: 0 0 $form-spacing-half 0
    position: relative
    font-weight: bold
    label
      white-space: nowrap
    &::before
      // Use &nbsp; to enforce the right text height in the container
      content: '\00a0'
    &.dito-width-fill
      // Crop labels that are too large when component fills available space
      label
        position: absolute
        overflow: hidden
        text-overflow: ellipsis
        left: 0
        right: 0
  .dito-schema-compact .dito-label
    display: inline-block
    // To align with content in selects:
    padding: ($input-padding-ver + $border-width) 0.35em 0 0
    label
      position: relative
      &::after
        content: ':'
</style>

<script>
import DitoComponent from '@/DitoComponent'

// @vue/component
export default DitoComponent.component('dito-label', {
  props: {
    dataPath: { type: String, required: true },
    text: { type: String, required: true }
  }
})
</script>
