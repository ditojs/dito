<template lang="pug">
textarea.dito-textarea.dito-input(
  :id="dataPath"
  ref="element"
  v-model="value"
  v-bind="attributes"
  :rows="lines"
  :class="{ 'dito-resizable': resizable }"
)
</template>

<script>
import TypeComponent from '../TypeComponent.js'
import { getSchemaAccessor } from '../utils/accessor.js'

// @vue/component
export default TypeComponent.register('textarea', {
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
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-textarea {
  display: block;
  resize: none;
  min-height: calc(1em * var(--line-height) + #{2 * $input-padding-ver});

  &.dito-resizable {
    resize: vertical;
  }
}
</style>
