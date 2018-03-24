<template lang="pug">
  input.dito-checkbox(
    :id="dataPath"
    type="checkbox"
    v-model="value"
    v-validate="validations"
    v-bind="getAttributes(true)"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('checkbox', {
  defaultValue() {
    return false
  }
})
</script>
