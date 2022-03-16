<template lang="pug">
  switch-button.dito-switch(
    ref="element"
    :id="dataPath"
    :sync="true"
    :labels="labels"
    v-model="value"
    v-bind="attributes"
    v-on="listeners"
  )
</template>

<style lang="sass">
  .dito-switch
    .dito-switch-label
      font-size: $font-size-small
</style>

<script>
import TypeComponent from '../TypeComponent.js'
import { SwitchButton } from '@ditojs/ui'

// @vue/component
export default TypeComponent.register('switch', {
  defaultValue: false,
  defaultWidth: 'auto',

  components: {
    SwitchButton
  },

  computed: {
    labels() {
      return this.schema.labels
    }
  }
})
</script>
