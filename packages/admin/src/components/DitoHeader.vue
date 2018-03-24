<template lang="pug">
  nav.dito-header
    .dito-trail
      ul
        li(
          v-for="(entry, index) in trail"
        )
          template(v-if="index === trail.length - 1")
            span {{ entry.breadcrumb }}
          router-link.dito-breadcrumb(v-else, :to="entry.path")
            span {{ entry.breadcrumb }}
      dito-spinner.dito-spinner(v-if="appState.loading > 0")
    dito-user(
      v-if="api.user"
      :user="api.user"
    )
    a.dito-login(
      v-else-if="allowLogin"
      @click="rootComponent.login()"
    )
      span Login
    span(
      v-else
    ) &nbsp;
</template>

<style lang="sass">
.dito
  .dito-header
    display: flex
    background: $color-black
    font-size: $menu-font-size
    line-height: $menu-line-height
    z-index: $menu-z-index
    +user-select(none)
    span
      display: block
      padding: $menu-padding
      color: $color-white
    .dito-trail
      display: flex
      box-sizing: border-box
      width: 100%
      max-width: $content-width
      ul
        display: flex
      a
        position: relative
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
      margin-top: $menu-padding-ver
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-header', {
  inject: ['api'],

  props: {
    allowLogin: { type: Boolean }
  },

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
