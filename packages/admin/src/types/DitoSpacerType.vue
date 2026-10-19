<!-- eslint-disable vue/valid-template-root -->
<template lang="pug"></template>
<script>
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'

// @vue/component
const DitoSpacerType = {
  props: fieldProps,

  setup(props) {
    useField(props)
  }
}

defineType({
  type: 'spacer',
  component: DitoSpacerType,
  defaultValue: undefined,
  defaultExclude: true,
  generatesLabel: false
})

export default DitoSpacerType
</script>
