<!-- eslint-disable vue/valid-template-root -->
<template lang="pug"></template>
<script>
import DitoComponent from '../DitoComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'
// @vue/component
const DitoTypeSpacer = DitoComponent.component('DitoTypeSpacer', {
  props: fieldProps,

  setup(props) {
    useField(props)
  }
})

defineType({
  types: ['spacer'],
  component: DitoTypeSpacer,
  defaultValue: undefined,
  excludeValue: true,
  generateLabel: false
})

export default DitoTypeSpacer
</script>
