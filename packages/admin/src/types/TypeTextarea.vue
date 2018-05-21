<template lang="pug">
  textarea.dito-textarea.dito-input(
    :id="dataPath"
    v-model="value"
    v-validate="validations"
    v-bind="getAttributes(true, true)"
    v-on="getEvents(true, true)"
    :rows="schema.lines || 4"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('textarea')
</script>
