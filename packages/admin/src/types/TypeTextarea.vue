<template lang="pug">
  textarea.dito-textarea.dito-input(
    ref="element"
    :id="dataPath"
    v-model="value"
    v-bind="attributes"
    v-on="listeners"
    :rows="lines"
    :class="{ 'dito-resizable': resizable }"
  )
</template>

<style lang="sass">
  .dito-textarea
    resize: none
    min-height: calc(1em * var(--line-height) + #{ 2 * $input-padding-ver })
    &.dito-resizable
      resize: vertical
</style>

<script>
import TypeComponent from '@/TypeComponent'
import { getSchemaAccessor } from '@/utils/accessor'

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
