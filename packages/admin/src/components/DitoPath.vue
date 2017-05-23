<template lang="pug">
  nav.dito-path
    ul
      li(v-for="(route, i) in $route.matched")
        template(v-if="i === $route.matched.length - 1") {{ getLabel(route) }}
        router-link(v-else, :to="getPath(i)") {{ getLabel(route) }}
    dito-spinner.dito-spinner(v-show="appState.loading")
</template>

<style lang="sass">
.dito
  .dito-path
    position: fixed
    top: 0
    width: 100%
    z-index: $menu-z-index
    padding: 1em
    background: hsl(0, 0%, 85%)
    font-size: $menu-font-size
    font-weight: bold
    margin-bottom: 0.5em
    ul
      margin: 0
      padding: 0
    li
      display: inline
    li + li::before
      content: ' > '
    ul,
    .dito-spinner
      float: left
    .dito-spinner
      margin-left: 0.5em
      &::before
        content: ''
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-path', {
  computed: {
    // Maps the route's actual path to the matched routes by counting its parts
    // separated by '/', splitting the path into the mapped parts containing
    // actual parameters. This is then used in getPath() to generate
    // hierarchical breadcrumb links that map to routes.
    matched() {
      const parts = this.$route.path.split('/')
      const matched = []
      let index = 0
      for (let match of this.$route.matched) {
        let end = match.path.split('/').length
        matched.push(parts.slice(index, end).join('/'))
        index = end
      }
      return matched
    }
  },

  methods: {
    getPath(level) {
      return this.matched.slice(0, level + 1).join('/')
    },

    getLabel(route) {
      const param = this.$route.params[route.meta.param]
      const prefix = param ? param === 'create' ? 'Create ' : 'Edit ' : ''
      return prefix + route.meta.label
    }
  }
})
</script>
