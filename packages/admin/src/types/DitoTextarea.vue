<template lang="pug">
  textarea.dito-textarea.dito-input(
    :id="name"
    :name="name"
    :title="label"
    v-model="value"
    v-validate="validations"
    :rows="schema.lines || 4"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
  )
</template>

<style lang="sass">
.dito
  .dito-textarea
    width: 100% // TODO: Change when grid is in place
    resize: none
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('textarea')
</script>
