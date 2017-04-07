<template lang="pug">
  .dito
    nav.dito-menu
      router-link(v-for="(desc, name) in views", :key="name", :to="`/${name}`")
        | {{desc.label}}
    main.dito-page
      dito-breadcrumbs
      router-view.dito-view
</template>

<style lang="sass">
  .dito
    .dito-menu
      float: left
      a
        display: block
    .dito-page
      float: left
      padding-left: 1em
    .dito-breadcrumbs,
    .dito-spinner
      float: left
    .dito-content,
    .dito-debug
      clear: left
      padding: 0.5em 0
    .dito-debug
      font-size: 0.75em
</style>

<script>
import BaseComponent from '@/BaseComponent'

export default BaseComponent.component('dito-root', {
  props: ['views']
})
</script>
