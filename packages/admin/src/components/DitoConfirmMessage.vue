<template lang="pug">
p.dito-confirm-message(
  v-html="modelValue"
)
</template>

<script>
// Displays the HTML message of the dialogs that `confirm()` shows, see
// `utils/dialogs.js`, as a `{ type: 'component' }` schema.
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
