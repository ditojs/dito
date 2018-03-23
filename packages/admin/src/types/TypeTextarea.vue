<template lang="pug">
  textarea.dito-textarea.dito-input(
    ref="element"
    :id="dataPath"
    :name="dataPath"
    :title="label"
    v-model="value"
    v-validate="validations"
    :data-vv-as="label"
    :rows="schema.lines || 4"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('textarea')
</script>
