<template lang="pug">
  .dito-errors
    ul
      li(v-for="error in errors.collect(name)")
        | {{ error }}
</template>

<style lang="sass">
.dito
  .dito-errors
    position: absolute
    ul
      margin-top: 2px
      color: $color-error
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-errors', {
  inject: ['$validator'],

  props: {
    name: { type: String, required: true }
  }
})
</script>
