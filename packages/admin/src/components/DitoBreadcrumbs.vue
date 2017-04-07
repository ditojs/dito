<template lang="pug">
  nav.dito-breadcrumbs
    ul
      li(v-for="(route, i) in $route.matched")
        span(v-if="i === $route.matched.length - 1") {{ route.meta.label }}
        router-link(v-else, :to="getPath(i)") {{ route.meta.label }}
</template>

<style lang="sass">
  .dito-breadcrumbs
    ul, li
      display: inline
      margin: 0
      padding: 0

    li + li::before
      content: ' > '
</style>

<script>
import BaseComponent from '@/BaseComponent'

export default BaseComponent.component('dito-breadcrumbs', {
  methods: {
    getPath(level) {
      return this.$route.path.split('/').slice(0, level - 1).join('/')
    }
  }
})
</script>
