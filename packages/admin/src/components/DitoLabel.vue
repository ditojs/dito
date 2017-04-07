<template lang="pug">
  label(:for="name") {{ text }}
</template>

<style lang="sass">
  .dito-form
    label::after
      content: ': '
</style>

<script>
import BaseComponent from '@/BaseComponent'

export default BaseComponent.component('dito-label', {
  props: ['name', 'text']
})
</script>
