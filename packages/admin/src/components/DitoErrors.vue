<template lang="pug">
  .dito-errors
    ul
      li(v-for="error in errors.collect(name)")
        | {{ error }}
</template>

<style lang="sass">
.dito
  .dito-errors
    ul
      margin: 0.5em 0
      color: #ff3860
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-errors', {
  props: {
    name: { type: String, required: true }
  }
})
</script>
