<template lang="pug">
  nav.dito-trail
    ul
      li(v-for="(entry, index) in trail")
        template(v-if="index === trail.length - 1")
          span {{ entry.breadcrumb }}
        router-link(v-else, :to="entry.path")
          span {{ entry.breadcrumb }}
    dito-spinner.dito-spinner(v-if="appState.loading > 0")
</template>

<style lang="sass">
.dito
  .dito-trail
    z-index: $menu-z-index
    background: $color-black
    font-size: $menu-font-size
    overflow: hidden
    line-height: $menu-line-height
    +user-select(none)
    li
      float: left
      & > *
        position: relative
        color: $color-white
    span
      display: block
      padding: $menu-padding
    a
      display: block
      padding-right: 0.4em
      $angle: 33deg
      &:hover
        color: #999
      &::after,
      &::before
        position: absolute
        content: ''
        width: 1px
        height: 1.2em
        right: -1px
        background: $color-dark
      &::before
        top: 50%
        transform: rotate($angle)
        transform-origin: top
      &::after
        bottom: 50%
        transform: rotate(-$angle)
        transform-origin: bottom
    .dito-spinner
      margin: $menu-padding-ver 0 0 $menu-padding-hor
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-trail', {
  computed: {
    trail() {
      const trail = []
      for (const component of this.appState.routeComponents) {
        if (component.routeRecord) {
          const { path, breadcrumb } = component
          trail.push({ path, breadcrumb })
        }
      }
      return trail
    }
  }
})
</script>
