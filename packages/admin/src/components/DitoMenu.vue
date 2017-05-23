<template lang="pug">
  nav.dito-menu
    ul
      li(v-for="(desc, name) in views")
        router-link(:to="`/${name}`") {{ renderLabel(desc, name) }}
</template>

<style lang="sass">
.dito
  .dito-menu
    background: hsl(0, 0%, 66%)
    padding: 1em
    ul li
      margin-bottom: 0.3em
    a
      font-weight: bold
      &.router-link-active
        color: $color-white
</style>

<script>
import DitoComponent from '@/DitoComponent'
import renderLabel from '@/utils/renderLabel'

export default DitoComponent.component('dito-menu', {
  props: {
    views: { type: Object, required: true }
  },

  methods: {
    renderLabel
  }
})
</script>
