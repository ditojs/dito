<template lang="pug">
  textarea.dito-textarea.dito-input(
    :id="name",
    :name="name",
    rows="8",
    v-model="data[name]",
    v-validate="validations",
    :placeholder="placeholder",
    :disabled="disabled",
    :readonly="readonly"
  )
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('textarea')
</script>
