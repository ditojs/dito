<template lang="pug">
//- Options shown all at once, like radios and checkboxes, grouped in fieldsets.
//- `isFirstOption` lets the component reference the input to focus.
ul.dito-option-list(:class="layoutClass")
  template(
    v-if="isGrouped"
  )
    li.dito-option-list__group(
      v-for="group in options"
      :key="group.label"
    )
      fieldset.dito-option-list__fieldset
        legend.dito-option-list__legend {{ group.label }}
        ul.dito-option-list__options(:class="layoutClass")
          li.dito-option-list__option(
            v-for="option in group.options"
          )
            slot(
              name="option"
              :option="option"
              :isFirstOption="option === firstOption"
            )
  template(
    v-else
  )
    li.dito-option-list__option(
      v-for="option in options"
    )
      slot(
        name="option"
        :option="option"
        :isFirstOption="option === firstOption"
      )
</template>

<script>
import { computed } from 'vue'

export default {
  props: {
    // With `isGrouped`, the groups of options with `label` and `options`:
    options: { type: Array, required: true },
    isGrouped: { type: Boolean, default: false },
    layout: { type: String, default: null }
  },

  setup(props) {
    return {
      layoutClass: computed(() => `dito-layout--${props.layout || 'vertical'}`),
      firstOption: computed(() => {
        const [firstEntry] = props.options
        return props.isGrouped ? firstEntry?.options[0] : firstEntry
      })
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-option-list {
  &__fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  &__legend {
    padding: 0;
    font-weight: bold;
  }
}
</style>
