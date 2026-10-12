<!-- eslint-disable vue/valid-template-root -->
<template lang="pug"></template>
<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { defineType } from '../utils/schema/types.ts'
// @vue/component
const DitoTypeSpacer = DitoTypeComponent.component('DitoTypeSpacer', {})

defineType({
  types: ['spacer'],
  component: DitoTypeSpacer,
  defaultValue: () => undefined, // Callback to override `defaultValue: null`
  excludeValue: true,
  generateLabel: false
})

export default DitoTypeSpacer
</script>
