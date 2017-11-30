<template lang="pug">
  label.dito-label(:for="name") {{ text }}
</template>

<style lang="sass">
.dito
  .dito-label
    display: block
    white-space: nowrap
    margin: 0 0 2px 0
    +user-select(none)
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
