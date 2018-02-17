<template lang="pug">
  input.dito-checkbox(
    ref="element"
    :id="dataPath"
    :name="dataPath"
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

export default TypeComponent.register('checkbox', {
  methods: {
    defaultValue() {
      return false
    }
  }
})
</script>
