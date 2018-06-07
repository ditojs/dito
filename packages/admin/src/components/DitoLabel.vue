<template lang="pug">
  label.dito-label(:for="dataPath") {{ text }}
</template>

<style lang="sass">
.dito
  .dito-label
    display: block
    white-space: nowrap
    margin: 0 0 $form-spacing-half 0
    +user-select(none)
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-label', {
  props: {
    dataPath: { type: String, required: true },
    text: { type: String, required: true }
  }
})
</script>
