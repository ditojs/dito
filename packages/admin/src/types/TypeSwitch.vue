<template lang="pug">
  toggle-button.dito-switch(
    :id="dataPath"
    :sync="true"
    :cssColors="true"
    :labels="schema.labels"
    :width="width"
    :height="height"
    v-model="value"
    v-validate="validations"
    v-bind="getAttributes()"
  )
</template>

<style lang="sass">
  .dito-switch
    display: inline-block
    vertical-align: baseline
    // TODO: Fix vue-js-toggle-button to allow more flexible style overrides
    font-size: inherit !important // override vue-js-toggle-button
    height: 2em
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

export default TypeComponent.register('switch', {
  defaultValue() {
    return false
  },

  computed: {
    width() {
      return this.schema.size?.width || 50
    },

    height() {
      return this.schema.size?.height || 22
    }
  }
})
</script>
