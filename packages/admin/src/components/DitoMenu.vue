<template lang="pug">
  nav.dito-menu
    h1 {{ appState.title }}
    ul
      li(v-for="view in views")
        router-link(:to="`/${view.path}`") {{ getLabel(view) }}
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
      line-height: $menu-line-height
      font-weight: bold
      background: $color-darker
      color: $color-white
    a
      padding: $menu-padding
      line-height: $menu-line-height
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
