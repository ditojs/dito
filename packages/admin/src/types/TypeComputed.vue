<template lang="pug">
  input.dito-text.dito-input(
    ref="element"
    :id="dataPath"
    :name="dataPath"
    type="text"
    :value="computedValue"
    :disabled="disabled"
    :readonly="true"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('computed', {
  computed: {
    computedValue() {
      const value = this.schema.compute(this.data, this.rootFormComponent.data)
      if (value !== undefined) {
        this.value = value
      }
      return this.value
    }
  }
})
</script>
