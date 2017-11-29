<template lang="pug">
  nav.dito-trail
    ul
      li(v-for="route in routes")
        template(v-if="route.last")
          span {{ route.breadcrumb }}
        router-link(v-else, :to="route.path")
          span {{ route.breadcrumb }}
    dito-spinner.dito-spinner(v-if="appState.loading")
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
    routes() {
      const matched = []
      let index = 0
      const { routeComponents } = this.appState
      // Maps the route's actual path to the matched routes by counting its
      // parts separated by '/', splitting the path into the mapped parts
      // containing actual parameters. This is then used in to
      // generate hierarchical breadcrumb links that map to routes.
      const parts = this.$route.path.split('/')
      for (const { path } of this.$route.matched) {
        const routeComponent = routeComponents[index++]
        const end = path.split('/').length
        matched.push({
          path: parts.slice(0, end).join('/'),
          breadcrumb: routeComponent && routeComponent.breadcrumb,
          last: end === parts.length
        })
      }
      return matched
    }
  }
})
</script>
