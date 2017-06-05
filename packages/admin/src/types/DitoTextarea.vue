<template lang="pug">
  textarea.dito-textarea.dito-input(
    :id="name",
    :name="name",
    v-model="data[name]",
    v-validate="validations",
    :rows="desc.lines || 4",
    :placeholder="placeholder",
    :disabled="disabled",
    :readonly="readonly"
  )
</template>

<style lang="sass">
.dito
  .dito-textarea
    min-width: 50% // TODO: Change when grid is in place
    resize: none
</style>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('textarea')
</script>
