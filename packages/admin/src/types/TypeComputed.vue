<template lang="pug">
  input.dito-text.dito-input(
    :id="name"
    :name="name"
    type="text"
    :value="value"
  )
</template>

<script>
import TypeComponent from '@/TypeComponent'

export default TypeComponent.register('computed', {
  computed: {
    value() {
      const value = this.schema.value(this.data)
      this.$set(this.data, this.schema.name, value)
      return value
    }
  }
})
</script>
