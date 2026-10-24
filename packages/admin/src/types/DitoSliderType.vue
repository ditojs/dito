<template lang="pug">
.dito-slider(
  :class=`{
    'dito-slider--has-errors': !!errorsElementId,
    'dito-slider--disabled': disabled
  }`
)
  input.dito-range(
    :id="componentPath"
    ref="element"
    v-model="inputValue"
    type="range"
    v-bind="attributes"
    :min="settings.minimum"
    :max="settings.maximum"
    :step="stepValue"
  )
  //- The range input holds the name and label, don't submit the number twice:
  DitoInput.dito-number(
    v-if="input"
    v-model="inputValue"
    type="number"
    v-bind="attributes"
    :name="null"
    :aria-label="`${labelText || labelize(schema.name)} Value`"
    :min="settings.minimum"
    :max="settings.maximum"
    :step="stepValue"
  )
</template>

<script>
import { computed } from 'vue'
import { labelize } from '@ditojs/utils'
import { defineType } from '../utils/schema/types.ts'
import { numberTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { useNumber } from '../composables/useNumber.ts'
import { DitoInput } from '@ditojs/ui/src'

// @vue/component
const DitoSliderType = {
  components: { DitoInput },
  props: fieldProps,

  setup(props) {
    const field = useField(props, { nativeField: true })
    return {
      ...field,
      ...useNumber(props, field),
      labelize,
      input: computed(() =>
        field.getSchemaValue('input', { type: Boolean, default: true })
      )
    }
  }
}

defineType({
  type: 'slider',
  component: DitoSliderType,
  ...numberTraits
})

export default DitoSliderType
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-slider {
  @extend %input;

  display: flex;

  &--has-errors {
    @extend %input--has-errors;
  }

  &--disabled {
    @extend %field--disabled;
  }

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
