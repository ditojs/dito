<template lang="pug">
SwitchButton.dito-switch(
  :id="dataPath"
  v-model="value"
  :labels="labels"
  v-bind="attributes"
)
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { SwitchButton } from '@ditojs/ui/src'

// @vue/component
export default DitoTypeComponent.register('switch', {
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

<style lang="scss">
@import '../styles/_imports';

.dito-switch {
  .dito-switch-label {
    font-size: $font-size-small;
  }
}
</style>
