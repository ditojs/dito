<template lang="pug">
  toggle-button.dito-switch(
    ref="element"
    :id="dataPath"
    :sync="true"
    :cssColors="true"
    :labels="schema.labels"
    :width="size.width"
    :height="size.height"
    v-model="value"
    v-bind="attributes"
    v-on="listeners"
  )
</template>

<style lang="sass">
  .dito-switch
    display: inline-block
    vertical-align: baseline
    // TODO: Fix vue-js-toggle-button to allow more flexible style overrides
    font-size: inherit !important // override vue-js-toggle-button
    height: 2em
    +user-select(none)
    .v-switch-core
      position: relative !important // override vue-js-toggle-button
      background-color: $color-light
      top: 50%
      transform: translateY(-50%)
    &.toggled
      .v-switch-core
        background-color: $color-active
    .v-switch-label
      font-size: 0.8em
      text-transform: uppercase
      top: 50% !important // override vue-js-toggle-button
      transform: translateY(-50%)
</style>

<script>
import TypeComponent from '@/TypeComponent'
import { ToggleButton } from 'vue-js-toggle-button'

// @vue/component
export default TypeComponent.register('switch', {
  defaultValue: false,

  components: {
    ToggleButton
  },

  computed: {
    size() {
      return this.schema.size || {
        width: 50,
        height: 22
      }
    }
  }
})
</script>
