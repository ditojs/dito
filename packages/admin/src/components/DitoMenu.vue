<template lang="pug">
  nav.dito-menu
    h1 Dito Admin
    ul
      li(v-for="(desc, name) in views")
        router-link(:to="`/${name}`") {{ renderLabel(desc, name) }}
</template>

<style lang="sass">
.dito
  .dito-menu
    background: $color-background
    font-size: $menu-font-size
    a,
    h1
      display: block
    h1
      padding: $menu-padding
      font-weight: bold
      background: $color-black
      color: $color-white
      line-height: $menu-line-height
    a
      padding: 0.2em $menu-padding-hor
      &.router-link-active
        color: $color-white
        background: $color-active
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
