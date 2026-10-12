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
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { DitoSwitch } from '@ditojs/ui/src'

// @vue/component
const DitoTypeSwitch = {
  name: 'DitoTypeSwitch',
  components: { DitoSwitch },
  props: fieldProps,

  setup(props) {
    const { value, attributes, context, componentPath } = useField(props)
    return { value, attributes, context, componentPath }
  }
}

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
