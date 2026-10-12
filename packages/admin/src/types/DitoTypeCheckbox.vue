<template lang="pug">
.dito-checkbox
  input(
    :id="componentPath"
    ref="element"
    v-model="value"
    type="checkbox"
    v-bind="attributes"
  )
</template>

<script>
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'

// @vue/component
const DitoTypeCheckbox = {
  name: 'DitoTypeCheckbox',
  props: fieldProps,

  setup(props) {
    const { value, attributes, context, componentPath } = useField(props, {
      nativeField: true
    })
    return { value, attributes, context, componentPath }
  }
}

defineType({
  types: ['checkbox'],
  component: DitoTypeCheckbox
})

export default DitoTypeCheckbox
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-checkbox {
  @extend %input-borderless;
}
</style>
