<template lang="pug">
//- The input of the container refers to the errors through `aria-describedby`:
.dito-errors(
  v-if="errors"
  :id="id"
  role="alert"
)
  ul
    li(
      v-for="error of errors"
    ) {{ error }}
</template>

<script>
export default {
  props: {
    id: { type: String, default: null },
    errors: { type: Array, default: null }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-errors {
  // Take a line of its own also in compact containers with wrapping rows.
  width: 100%;
  // Wrap within the width of the field instead of widening it:
  contain: inline-size;
  margin-top: $form-spacing-half;
  color: $color-error;
  white-space: pre-line;
}
</style>
