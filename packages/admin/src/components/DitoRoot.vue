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
  @import "dito"

  .dito-menu,
  .dito-path
    font-size: 1.2em

  .dito-menu
    float: left
    ul
      list-style: none
      margin: 0
      padding: 0
      li
        margin: 0 0 0.3em
    a
      font-weight: bold
      &.router-link-active
        color: #f00

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

  .dito-content
    clear: left

  .dito-debug
    // display: none
    clear: left
    padding-bottom: 0.5em
    color: #999

  .dito-error
    color: #f30
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
