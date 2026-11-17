<template lang="pug">
//- Pass the label as `aria-label`, as reka reads its text only once:
DitoSwitch.dito-switch(
  :id="componentPath"
  ref="element"
  v-model="value"
  :labels="schema.labels"
  :aria-label="labelText"
  v-bind="attributes"
)
</template>

<script>
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { DitoSwitch } from '@ditojs/ui/src'

// @vue/component
const DitoSwitchType = {
  components: { DitoSwitch },
  props: fieldProps,
  // reka-ui's switch emits no native change events:
  setup: props =>
    useField(props, {
      getEvents: ({ onFocus, onBlur, onChange }) => ({
        onFocus,
        onBlur,
        'onUpdate:modelValue': onChange
      })
    })
}

defineType({
  type: 'switch',
  component: DitoSwitchType,
  defaultValue: false,
  defaultWidth: 'auto',
  getProperty: () => ({ type: 'boolean' })
})

export default DitoSwitchType
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-switch {
  &__label {
    font-size: $font-size-small;
  }
}
</style>
