<template lang="pug">
  textarea.dito-textarea.dito-input(
    :id="dataPath"
    v-model="value"
    v-validate="validations"
    v-bind="getAttributes()"
    v-on="getEvents()"
    :rows="schema.lines || 4"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('textarea', {
  nativeField: true,
  textField: true
})
</script>
