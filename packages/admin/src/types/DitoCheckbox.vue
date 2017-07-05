<template lang="pug">
  input.dito-checkbox(
    :id="name"
    :name="name"
    type="checkbox"
    v-model="value"
    v-validate="validations"
    :disabled="disabled"
  )
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('checkbox')
</script>
