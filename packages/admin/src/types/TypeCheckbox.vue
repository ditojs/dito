<template lang="pug">
  input.dito-checkbox(
    :id="dataPath"
    type="checkbox"
    v-model="value"
    v-validate="validations"
    v-bind="getAttributes()"
    v-on="getEvents()"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

// @vue/component
export default TypeComponent.register('checkbox', {
  nativeField: true
})
</script>
