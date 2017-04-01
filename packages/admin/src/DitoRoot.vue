<template lang="pug">
  .dito
    nav
      template(v-for="(props, name) in schema")
        router-link(:to="`/${name}`") {{props.label}}
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
