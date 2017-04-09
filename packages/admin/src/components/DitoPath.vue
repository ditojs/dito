<template lang="pug">
  nav.dito-path
    ul
      li(v-for="(route, i) in $route.matched")
        span(v-if="i === $route.matched.length - 1") {{ route.meta.label }}
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
import BaseComponent from '@/BaseComponent'

export default BaseComponent.component('dito-path', {
  computed: {
    parts() {
      return this.$route.path.split('/')
    }
  },

  methods: {
    getPath(level) {
      return this.parts.slice(0, level - 1).join('/')
    }
  }
})
</script>
