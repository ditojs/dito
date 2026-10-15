<template lang="pug">
//- Without a label, the buttons show in place, e.g. in the header of the type:
Teleport(
  :to="target"
  :disabled="!target"
  defer
)
  .dito-label-buttons(:class="`dito-label-buttons--${position}`")
    slot
</template>

<script>
import { computed } from 'vue'

export default {
  props: {
    // The id of the label, see `fieldProps`:
    labelId: { type: String, default: null },
    // Before the text of the label, or at its end:
    position: { type: String, default: 'end' }
  },

  setup(props) {
    return {
      // Component paths contain slashes:
      target: computed(
        () => (
          props.labelId &&
          `#${CSS.escape(props.labelId)} > .dito-label__buttons--${
            props.position
          }`
        )
      )
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-label-buttons {
  display: flex;
  align-items: center;

  &:empty {
    display: none;
  }

  // Inset the buttons like the ones in the cells of the component's table:
  &--start {
    margin-left: $form-spacing + $border-width;
  }

  &--end:last-child {
    margin-right: $form-spacing + $border-width;
  }

  .dito-label__buttons--end > & {
    margin-left: $form-spacing;
  }
}

// Keep the round buttons at the end of the label apart from the component,
// like the buttons in the headers of forms:
.dito-label:has(> .dito-label__buttons--end > .dito-label-buttons:not(:empty)) {
  margin-bottom: $form-spacing-half;
}
</style>
