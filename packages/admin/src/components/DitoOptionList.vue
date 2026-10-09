<template lang="pug">
//- The list of the options of an options component that shows all of them at
//- once, e.g. radio buttons and checkboxes. Grouped options, see
//- `schema.groupBy`, are listed in a fieldset per group. The `option` slot
//- renders each option, and receives `isFirstOption` so that the component can
//- reference the input to focus, see `TypeMixin.getFocusElement()`.
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
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('DitoOptionList', {
  props: {
    // The options, or with `isGrouped` their groups, each with `label` and
    // `options`, see `OptionsMixin.groupOptions()`.
    options: { type: Array, required: true },
    isGrouped: { type: Boolean, default: false },
    layout: { type: String, default: null }
  },

  computed: {
    layoutClass() {
      return `dito-layout--${this.layout || 'vertical'}`
    },

    firstOption() {
      const [firstEntry] = this.options
      return this.isGrouped ? firstEntry?.options[0] : firstEntry
    }
  }
})
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
