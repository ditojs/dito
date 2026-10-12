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
    const { focus } = useField(props)
    return { focus }
  }
})

defineType({
  types: ['spacer'],
  component: DitoTypeSpacer,
  defaultValue: () => undefined, // Callback to override `defaultValue: null`
  excludeValue: true,
  generateLabel: false
})

export default DitoTypeSpacer
</script>
