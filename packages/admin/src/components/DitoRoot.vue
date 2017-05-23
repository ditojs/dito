<template lang="pug">
  .dito
    dito-menu(:views="views")
    main.dito-page
      dito-path
      router-view
</template>

<style lang="sass">
.dito
  // Import everything name-spaced in .dito
  @import "dito"

  height: 100%
  display: flex
  flex-flow: row wrap
  align-content: stretch

  .dito-page
    flex: 1 1
    overflow-y: scroll
</style>

<script>
import DitoComponent from '@/DitoComponent'
import DitoSpinner from 'vue-spinner/src/PulseLoader'

DitoComponent.component('dito-spinner', DitoSpinner)

export default DitoComponent.component('dito-root', {
  props: {
    views: { type: Object, required: true },
    settings: { type: Object, required: true }
  },

  created() {
    const settings = this.settings
    const spinner = settings && settings.spinner
    if (spinner) {
      const props = DitoSpinner.props
      props.size.default = spinner.size || '6px'
      props.color.default = spinner.color || '#999'
    }
  }
})
</script>
