<template lang="pug">
  nav.dito-menu
    h1 Dito Admin
    ul
      li(v-for="schema in views")
        router-link(:to="`/${schema.path}`") {{ renderLabel(schema) }}
</template>

<style lang="sass">
.dito
  .dito-menu
    background: $color-lightest
    font-size: $menu-font-size
    white-space: nowrap
    +user-select(none)
    a,
    h1
      display: block
    h1
      padding: $menu-padding
      font-weight: bold
      background: $color-darker
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

export default DitoComponent.component('dito-menu', {
  props: {
    views: { type: Object, required: true }
  }
})
</script>
