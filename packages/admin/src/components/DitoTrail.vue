<template lang="pug">
  nav.dito-trail
    ul
      li(v-for="(route, level) in $route.matched")
        template(v-if="level === $route.matched.length - 1")
          span {{ getRouteLabel(route) }}
        router-link(v-else, :to="getPathUpTo(level)")
          span {{ getRouteLabel(route) }}
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
    // Maps the route's actual path to the matched routes by counting its parts
    // separated by '/', splitting the path into the mapped parts containing
    // actual parameters. This is then used in getPathUpTo() to generate
    // hierarchical breadcrumb links that map to routes.
    matched() {
      const parts = this.$route.path.split('/')
      const matched = []
      let index = 0
      for (const record of this.$route.matched) {
        const end = record.path.split('/').length
        matched.push(parts.slice(index, end).join('/'))
        index = end
      }
      return matched
    }
  },

  methods: {
    getPathUpTo(level) {
      return this.matched.slice(0, level + 1).join('/')
    },

    getRouteLabel(route) {
      const { meta } = route
      const { labelSchema } = meta
      let { breadcrumb } = labelSchema
      if (!breadcrumb) {
        const param = this.$route.params[meta.param]
        const prefix = param ? param === 'create' ? 'Create' : 'Edit' : ''
        breadcrumb = `${prefix} ${this.getLabel(labelSchema)}`
      }
      return breadcrumb
    }
  }
})
</script>
