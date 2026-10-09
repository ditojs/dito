<template lang="pug">
//- The input of the container refers to the errors by `id` through
//- `aria-describedby`, see `TypeMixin.attributes`.
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
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('DitoErrors', {
  props: {
    id: { type: String, default: null },
    errors: { type: Array, default: null }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-errors {
  // Take a line of its own also in compact containers with wrapping rows.
  width: 100%;
  margin-top: $form-spacing-half;
  color: $color-error;
  white-space: pre-line;
}
</style>
