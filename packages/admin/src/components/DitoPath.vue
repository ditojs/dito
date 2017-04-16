<template lang="pug">
  nav.dito-path
    ul
      li(v-for="(route, i) in $route.matched", v-if="route.meta.label")
        template(v-if="i === $route.matched.length - 1") {{ route.meta.label }}
        router-link(v-else, :to="getPath(i)") {{ route.meta.label }}
</template>

<style lang="sass">
  .dito-path
    ul
      margin: 0
      padding: 0
    li
      display: inline

    li + li::before
      content: ' > '
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
    }
  }
})
</script>
