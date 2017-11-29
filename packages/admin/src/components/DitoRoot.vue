<template lang="pug">
  .dito
    notifications(position="top right" ref="notifications")
    dito-menu(:schemas="schemas")
    main.dito-page
      dito-trail
      router-view
</template>

<style lang="sass">
.dito
  // Import everything name-spaced in .dito
  @import "dito"

  height: 100%
  display: flex
  .dito-page
    flex: 1
    display: flex
    flex-flow: column
    .dito-view
      flex: 1
      min-height: 0
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.component('dito-root', {
  props: {
    schemas: { type: Object, required: true },
    settings: { type: Object, required: true }
  },

  created() {
    const { spinner = {} } = this.settings || {}
    const { props } = DitoComponent.get('dito-spinner').options
    props.size.default = spinner.size || '8px'
    props.color.default = spinner.color || '#999'
  }
})
</script>
