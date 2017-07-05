<template lang="pug">
  input.dito-text.dito-input(
    :id="name"
    :name="name"
    type="text"
    v-model="value"
    v-validate="validations"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
  )
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('text')
</script>
