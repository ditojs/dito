<template lang="pug">
  .dito
    notifications(position="top right")
    dito-menu(:views="views")
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
    views: { type: Object, required: true },
    settings: { type: Object, required: true }
  },

  created() {
    const { spinner } = this.settings || {}
    if (spinner) {
      const { props } = DitoComponent.get('dito-spinner').options
      props.size.default = spinner.size || '6px'
      props.color.default = spinner.color || '#999'
    }
  }
})
</script>
