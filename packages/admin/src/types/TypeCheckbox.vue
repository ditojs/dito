<template lang="pug">
  input.dito-checkbox(
    :id="name"
    :name="name"
    type="checkbox"
    :title="label"
    v-model="value"
    v-validate="validations"
    :data-vv-as="label"
    :disabled="disabled"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('checkbox')
</script>
