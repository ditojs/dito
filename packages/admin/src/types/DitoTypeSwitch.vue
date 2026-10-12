<template lang="pug">
DitoSwitch.dito-switch(
  :id="componentPath"
  ref="element"
  v-model="value"
  :labels="schema.labels"
  v-bind="attributes"
)
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { DitoSwitch } from '@ditojs/ui/src'

// @vue/component
const DitoTypeSwitch = DitoComponent.component('DitoTypeSwitch', {
  components: { DitoSwitch },
  props: fieldProps,

  setup(props) {
    const { value, attributes } = useField(props)
    return { value, attributes }
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
