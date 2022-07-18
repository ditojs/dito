<template lang="pug">
  nav.dito-menu.dito-scroll-parent
    h1 {{ appState.title }}
    ul.dito-scroll
      li(v-for="view in views")
        router-link.dito-link(
          v-if="shouldRender(view)"
          :to="`/${view.path}`"
          active-class="dito-active"
        ) {{ getLabel(view) }}
</template>

<style lang="sass">
  .dito-menu
    flex: initial
    font-size: $menu-font-size
    white-space: nowrap
    +user-select(none)
    ul
      background: $color-lighter
      border-right: $border-style
    a,
    h1
      display: block
    h1
      padding: $menu-padding
      line-height: $menu-line-height
      font-weight: bold
      background: $color-darker
      border-right: $border-width solid $color-darkest
      color: $color-white
    .dito-link
      padding: $menu-padding
      line-height: $menu-line-height
      &.dito-active
        color: $color-white
        background: $color-active
  .dito-link
    &:focus:not(:active):not(.dito-active)
      box-shadow: $shadow-focus
</style>

<script>
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('dito-menu', {})
</script>
