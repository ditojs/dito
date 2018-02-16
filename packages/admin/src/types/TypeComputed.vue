<template lang="pug">
  input.dito-text.dito-input(
    :id="name"
    :name="name"
    type="text"
    :value="computedValue"
    :readonly="true"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('computed', {
  computed: {
    computedValue() {
      const value = this.schema.compute(this.data, this.formComponent.data)
      if (value !== undefined) {
        this.value = value
      }
      return this.value
    }
  }
})
</script>
