<template lang="pug">
  .dito
    nav
      router-link(v-for="(desc, name) in views", :key="name", :to="`/${name}`")
        | {{desc.label}}
    main
      router-view
</template>

<style lang="sass">
  .dito
    nav
      float: left
      a
        display: block
    main
      margin-left: 1em
      float: left
</style>

<script>
import BaseComponent from '@/BaseComponent'

export default BaseComponent.component('dito-root', {
  props: ['views']
})
</script>
