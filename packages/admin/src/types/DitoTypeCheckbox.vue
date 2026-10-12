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
import DitoComponent from '../DitoComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'

// @vue/component
const DitoTypeCheckbox = DitoComponent.component('DitoTypeCheckbox', {
  props: fieldProps,

  setup(props) {
    const { value, attributes } = useField(props, {
      nativeField: true
    })
    return { value, attributes }
  }
})

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
