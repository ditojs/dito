<template lang="pug">
  input.dito-checkbox(
    ref="element"
    :id="dataPath"
    type="checkbox"
    v-model="value"
    v-validate="validations"
    v-bind="attributes"
    v-on="listeners"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

// @vue/component
export default TypeComponent.register('checkbox', {
  nativeField: true
})
</script>
