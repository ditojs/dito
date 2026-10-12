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
import DitoTypeComponent from '../DitoTypeComponent.js'
import { defineType } from '../utils/schema/types.ts'

// @vue/component
const DitoTypeCheckbox = DitoTypeComponent.component('DitoTypeCheckbox', {
  nativeField: true
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
