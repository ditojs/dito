<template lang="pug">
  .dito
    nav
      router-link(v-for="(desc, name) in schema", :key="name", :to="`/${name}`")
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
      float: left
</style>

<script>
import DitoComponent from './DitoComponent'
import './components'

export default DitoComponent.extend({
  data() {
    return {
      schema: this.getMeta()
    }
  }
})
</script>
