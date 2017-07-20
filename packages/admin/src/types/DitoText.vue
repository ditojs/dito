<template lang="pug">
  input.dito-text.dito-input(
    :id="name"
    :name="name"
    :type="type"
    :title="label"
    :value="value"
    @input="onInput"
    v-validate="validations"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
  )
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register(['text', 'email', 'url', 'tel'], {
  methods: {
    onInput(event) {
      this.value = event.target.value
    }
  }
})
</script>
