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
import DitoTypeComponent from '@/DitoTypeComponent'

// @vue/component
export default DitoTypeComponent.register('checkbox', {
  nativeField: true
})
</script>
