<template lang="pug">
DitoSwitch.dito-switch(
  :id="componentPath"
  ref="element"
  v-model="value"
  :labels="labels"
  v-bind="attributes"
)
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { DitoSwitch } from '@ditojs/ui/src'

// @vue/component
const DitoTypeSwitch = DitoTypeComponent.component('DitoTypeSwitch', {
  components: {
    DitoSwitch
  },

  computed: {
    labels() {
      return this.schema.labels
    }
  }
})

defineType({
  types: ['switch'],
  component: DitoTypeSwitch,
  defaultValue: false,
  defaultWidth: 'auto'
})

export default DitoTypeSwitch
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-switch {
  &__label {
    font-size: $font-size-small;
  }
}
</style>
