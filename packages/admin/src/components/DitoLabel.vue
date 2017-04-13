<template lang="pug">
  label.dito-label(:for="name") {{ text }}
</template>

<style lang="sass">
  .dito-label::after
    content: ': '
</style>

<script>
import BaseComponent from '@/BaseComponent'

export default BaseComponent.component('dito-label', {
  props: {
    name: { type: String, required: true },
    text: { type: String, required: true }
  }
})
</script>
