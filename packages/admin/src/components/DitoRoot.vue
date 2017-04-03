<template lang="pug">
  .dito
    nav
      router-link(v-for="(desc, name) in $meta.views", :key="name", :to="`/${name}`")
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
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-root', {
})
</script>
