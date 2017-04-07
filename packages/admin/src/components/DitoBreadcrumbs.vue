<template lang="pug">
  ul.breadcrumbs
    li(v-for="(route, i) in $route.matched")
      span(v-if="i === $route.matched.length - 1") {{ route.meta.label }}
      router-link(v-else, :to="getPath(i)") {{ route.meta.label }}
</template>

<style lang="sass">
  .dito
    ul.breadcrumbs
      &, li
        display: inline
      li + li:before
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
