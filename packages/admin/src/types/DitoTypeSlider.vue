<template lang="pug">
.dito-slider
  input.dito-range(
    :id="componentPath"
    ref="element"
    v-model="inputValue"
    type="range"
    v-bind="attributes"
    :min="min"
    :max="max"
    :step="stepValue"
  )
  //- The range input holds the name and the label of the field, the number
  //- input gets a label of its own and no name, to not submit it twice:
  DitoInput.dito-number(
    v-if="input"
    v-model="inputValue"
    type="number"
    v-bind="attributes"
    :name="null"
    :aria-label="numberInputLabel"
    :min="min"
    :max="max"
    :step="stepValue"
  )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import NumberMixin from '../mixins/NumberMixin.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { DitoInput } from '@ditojs/ui/src'

// @vue/component
export default DitoTypeComponent.register('slider', {
  mixins: [NumberMixin],
  components: { DitoInput },
  nativeField: true,

  computed: {
    // TODO: Rename to `showInput`?
    input: getSchemaAccessor('input', {
      type: Boolean,
      default: true
    }),

    numberInputLabel() {
      return `${this.label || this.labelize(this.name)} Value`
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-slider {
  @extend %input;

  display: flex;

  .dito-range {
    flex: auto;
    height: calc(1em * var(--line-height));
  }

  .dito-number {
    border: 0;
    padding: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
}
</style>
