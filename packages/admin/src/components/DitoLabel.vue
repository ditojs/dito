<template lang="pug">
  label.dito-label(:for="name") {{ text }}
</template>

<style lang="sass">
  .dito-label
    vertical-align: middle
    white-space: nowrap
    &::after
      content: ': '
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
