<template lang="pug">
  label.dito-label(:for="name") {{ text }}
</template>

<style lang="sass">
.dito
  .dito-label
    display: block
    white-space: nowrap
    margin: 4px 0 2px 0
    +user-select(none)
    &::after
      content: ':'
      margin-right: 0.35em
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-label', {
  props: {
    name: { type: String, required: true },
    text: { type: String, required: true }
  }
})
</script>
