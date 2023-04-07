<template lang="pug">
SwitchButton.dito-switch(
  :id="dataPath"
  ref="element"
  v-model="value"
  :labels="labels"
  v-bind="attributes"
)
</template>

<script>
import TypeComponent from '../TypeComponent.js'
import { SwitchButton } from '@ditojs/ui/src'

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

<style lang="sass">
@import '../styles/_imports'

.dito-switch
  .dito-switch-label
    font-size: $font-size-small
</style>
