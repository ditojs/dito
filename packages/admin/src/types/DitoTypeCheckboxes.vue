<template lang="pug">
ul.dito-checkboxes(
  :id="dataPath"
  :class="`dito-layout--${schema.layout || 'vertical'}`"
)
  li(
    v-for="option in options"
  )
    label
      .dito-checkbox
        input(
          ref="element"
          v-model="selectedOptions"
          type="checkbox"
          :value="getValueForOption(option)"
          v-bind="attributes"
        )
        span {{ getLabelForOption(option) }}
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
  defaultMultiple: true,

  computed: {
    // @override
    multiple() {
      return true
    },

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

  input {
    margin-right: $form-spacing;
  }
}
</style>
