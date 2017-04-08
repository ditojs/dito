<template lang="pug">
  .dito
    nav.dito-menu
      router-link(v-for="(desc, name) in views", :key="name", :to="`/${name}`")
        | {{desc.label}}
    main.dito-page
      dito-path
      router-view.dito-view
</template>

<style lang="sass">
  .dito-menu
    float: left
    a
      display: block
    .router-link-active
      font-weight: bold
  .dito-page
    float: left
    padding-left: 1em
  .dito-path,
  .dito-spinner
    padding-left: 0.25em
    float: left
  .dito-path
    font-weight: bold
  .dito-content
    clear: left
  .dito-debug
    // display: none
    clear: left
    padding-top: 0.5em
    font-size: 0.8em
    color: #999
</style>

<script>
import BaseComponent from '@/BaseComponent'

import DitoSpinner from 'vue-spinner/src/PulseLoader'
BaseComponent.component('dito-spinner', DitoSpinner)

export default BaseComponent.component('dito-root', {
  props: ['views', 'settings'],

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
