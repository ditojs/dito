<template lang="pug">
  textarea.dito-textarea.dito-input(
    ref="element"
    :id="dataPath"
    v-model="value"
    v-validate="validations"
    v-bind="attributes"
    v-on="listeners"
    :rows="schema.lines || 4"
  )
</template>

<script>
import DitoTypeComponent from '@/DitoTypeComponent'

// @vue/component
export default DitoTypeComponent.register('textarea', {
  nativeField: true,
  textField: true
})
</script>
