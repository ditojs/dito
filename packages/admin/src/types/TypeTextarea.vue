<template lang="pug">
  textarea.dito-textarea.dito-input(
    ref="element"
    :id="dataPath"
    v-model="value"
    v-validate="validations"
    v-bind="attributes"
    v-on="events"
    :rows="schema.lines || 4"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

// @vue/component
export default TypeComponent.register('textarea', {
  nativeField: true,
  textField: true
})
</script>
