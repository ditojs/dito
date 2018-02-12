<template lang="pug">
  input.dito-text.dito-input(
    :id="name"
    :name="name"
    type="text"
    :value="value"
    :readonly="true"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('computed', {
  computed: {
    value() {
      const value = this.schema.value(this.data)
      if (value !== undefined) {
        this.$set(this.data, this.schema.name, value)
      }
      return this.data[this.schema.name]
    }
  }
})
</script>
