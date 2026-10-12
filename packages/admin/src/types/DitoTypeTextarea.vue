<template lang="pug">
textarea.dito-textarea.dito-input(
  :id="componentPath"
  ref="element"
  v-model="value"
  v-bind="attributes"
  :rows="lines"
  :class="{ 'dito-textarea--resizable': resizable }"
)
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { textDescriptor } from './descriptors.ts'
import TextMixin from '../mixins/TextMixin'
import { getSchemaAccessor } from '../utils/accessor.js'

// @vue/component
const DitoTypeTextarea = DitoTypeComponent.component('DitoTypeTextarea', {
  mixins: [TextMixin],
  nativeField: true,
  textField: true,

  computed: {
    lines() {
      return this.schema.lines || 4
    },

    resizable: getSchemaAccessor('resizable', {
      type: Boolean,
      default: false
    })
  }
})

defineType({
  types: ['textarea'],
  component: DitoTypeTextarea,
  ...textDescriptor
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
