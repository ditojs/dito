<template lang="pug">
ul.dito-checkboxes(
  :id="dataPath"
  :class="`dito-layout-${schema.layout || 'vertical'}`"
)
  li(
    v-for="option in options"
  )
    label
      input.dito-checkbox(
        ref="element"
        v-model="selectedOptions"
        type="checkbox"
        :value="getValueForOption(option)"
        v-bind="attributes"
      )
      | {{ getLabelForOption(option) }}
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import OptionsMixin from '../mixins/OptionsMixin.js'

// @vue/component
export default DitoTypeComponent.register('checkboxes', {
  mixins: [OptionsMixin],

  nativeField: true,
  defaultValue: [],
  defaultWidth: 'auto',

  computed: {
    selectedOptions: {
      get() {
        return (this.selectedValue || []).filter(value => value)
      },

      set(option) {
        this.selectedValue = option || []
      }
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-checkboxes {
  label {
    @extend %input-borderless;
  }

  .dito-checkbox {
    margin-right: $form-spacing;
  }
}
</style>
