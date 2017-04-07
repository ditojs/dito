<template lang="pug">
  .dito
    aside
      router-link(v-for="(desc, name) in views", :key="name", :to="`/${name}`")
        | {{desc.label}}
    nav
      dito-breadcrumbs
    main
      router-view
</template>

<style lang="sass">
  .dito
    aside
      float: left
      a
        display: block
    nav
      float: left
    main
      margin-left: 1em
      float: left
      clear: left
</style>

<script>
import BaseComponent from '@/BaseComponent'

export default BaseComponent.component('dito-root', {
  props: ['views']
})
</script>
