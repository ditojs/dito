<template lang="pug">
  .dito-errors
    ul
      li(v-for="error in $errors.collect(dataPath)")
        | {{ error }}
</template>

<style lang="sass">
.dito
  .dito-errors
    position: absolute
    ul
      margin-top: 1px
      color: $color-error
      li
        background: $color-white
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-errors', {
  inject: ['$validator'],

  props: {
    dataPath: { type: String, required: true }
  }
})
</script>
