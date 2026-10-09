<template lang="pug">
p.dito-confirm-message(
  v-html="value"
)
</template>

<script>
// Displays the HTML message of the dialogs that `confirm()` shows, see
// `utils/dialogs.js`, as a `{ type: 'component' }` schema, which adds
// `DitoMixin` and `TypeMixin` to provide `value`.
export default {}
</script>

<style lang="scss">
.dito-confirm-message {
  margin: 0;
}
</style>
