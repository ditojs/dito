<template lang="pug">
  .dito-errors(
    v-if="errors"
  )
    ul
      li(v-for="error of errors")
        | {{ error }}
</template>

<style lang="sass">
  .dito-errors
    position: absolute
    z-index: 1
    ul
      margin-top: 1px
      color: $color-error
</style>

<script>
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('dito-errors', {
  props: {
    errors: { type: Array, default: null }
  }
})
</script>
