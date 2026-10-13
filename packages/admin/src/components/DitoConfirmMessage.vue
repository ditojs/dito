<template lang="pug">
p.dito-confirm-message(
  v-html="modelValue"
)
</template>

<script>
// The HTML message of `confirm()` dialogs, as a `{ type: 'component' }` schema.
export default {
  emits: ['update:modelValue', 'change'],

  props: {
    schema: { type: Object, required: true },
    context: { type: Object, required: true },
    modelValue: { type: String, required: true }
  }
}
</script>

<style lang="scss">
.dito-confirm-message {
  margin: 0;
}
</style>
