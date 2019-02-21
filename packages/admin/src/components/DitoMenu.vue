<template lang="pug">
  nav.dito-menu.dito-scroll-parent
    h1 {{ appState.title }}
    ul.dito-scroll
      li(v-for="view in views")
        router-link(
          :to="`/${view.path}`"
          v-if="shouldRender(view)"
        ) {{ getLabel(view) }}
</template>

<style lang="sass">
.dito
  .dito-menu
    background: $color-lightest
    flex: initial
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

// @vue/component
export default DitoComponent.component('dito-menu', {
  props: {
    views: { type: Object, required: true }
  }
})
</script>
