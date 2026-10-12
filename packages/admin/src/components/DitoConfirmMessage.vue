<template lang="pug">
p.dito-confirm-message(
  v-html="modelValue"
)
</template>

<script>
// The HTML message of `confirm()` dialogs, as a `{ type: 'component' }` schema.
export default {
  // The message is the only prop of custom components that it needs:
  inheritAttrs: false,

  props: {
    modelValue: { type: String, required: true }
  }
}
</script>

<style lang="scss">
.dito-confirm-message {
  margin: 0;
}
</style>
