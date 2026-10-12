<template lang="pug">
textarea.dito-textarea.dito-input(
  :id="componentPath"
  ref="element"
  v-model="value"
  v-bind="attributes"
  :rows="schema.lines || 4"
  :class="{ 'dito-textarea--resizable': resizable }"
)
</template>

<script>
import { computed } from 'vue'
import { defineType } from '../utils/schema/types.ts'
import { textTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'

// @vue/component
const DitoTypeTextarea = {
  name: 'DitoTypeTextarea',
  props: fieldProps,

  setup(props) {
    const field = useField(props, { nativeField: true, textField: true })
    return {
      ...field,
      resizable: computed(() =>
        field.getSchemaValue('resizable', { type: Boolean, default: false })
      )
    }
  }
}

defineType({
  types: ['textarea'],
  component: DitoTypeTextarea,
  ...textTraits
})

export default DitoTypeTextarea
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-textarea {
  display: block;
  resize: none;
  min-height: calc(1em * var(--line-height) + #{2 * $input-padding-ver});

  &--resizable {
    resize: vertical;
  }
}
</style>
