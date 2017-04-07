<template lang="pug">
  .dito
    nav.dito-menu
      router-link(v-for="(desc, name) in views", :key="name", :to="`/${name}`")
        | {{desc.label}}
    main.dito-page
      dito-breadcrumbs
      router-view.dito-view
</template>

<style lang="sass">
  .dito
    .dito-menu
      float: left
      a
        display: block
    .dito-page
      float: left
      padding-left: 1em
    .dito-breadcrumbs,
    .dito-spinner
      padding: 0 0 0 0.25em
      float: left
    .dito-content,
    .dito-debug
      clear: left
      padding: 0.5em 0
    .dito-debug
      font-size: 0.75em
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
