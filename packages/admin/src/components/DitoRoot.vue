<template lang="pug">
  .dito
    nav.dito-menu
      ul
        li(v-for="(desc, name) in views")
          router-link(:to="`/${name}`") {{ renderLabel(desc, name) }}
    main.dito-page
      dito-path
      router-view.dito-view
</template>

<style lang="sass">
.dito
  // Import everything name-spaced in .dito
  @import "dito"

  .dito-menu,
  .dito-path
    font-size: 1.2em

  .dito-menu
    float: left
    ul li
        margin-bottom: 0.3em
    a
      font-weight: bold
      &.router-link-active
        color: $color-active

  .dito-path
    font-weight: bold
    margin-bottom: 0.5em

  .dito-page
    float: left
    padding-left: 2em

  .dito-path,
  .dito-spinner
    float: left

  .dito-spinner
    display: inline
    padding: 0.15em 0 0 0.25em

  .dito-view
    // To make the floating spinner alyways go up to the path
    display: inline
</style>

<script>
import DitoComponent from '@/DitoComponent'
import DitoSpinner from 'vue-spinner/src/PulseLoader'
import renderLabel from '@/utils/renderLabel'

DitoComponent.component('dito-spinner', DitoSpinner)

export default DitoComponent.component('dito-root', {
  props: {
    views: { type: Object, required: true },
    settings: { type: Object, required: true }
  },

  methods: {
    renderLabel
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
