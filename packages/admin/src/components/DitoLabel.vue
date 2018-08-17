<template lang="pug">
  label.dito-label(:for="dataPath") {{ text }}
</template>

<style lang="sass">
.dito
  .dito-label
    display: block
    margin: 0 0 $form-spacing-half 0
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
    +user-select(none)
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
