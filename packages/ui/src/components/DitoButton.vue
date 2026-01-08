<template lang="pug">
button.dito-button(
  :type="type"
  :title="title"
  :disabled="disabled"
  :class="[classes, { 'dito-button--affixed': hasAffixes }]"
  v-bind="attributes"
)
  .dito-button__prefix(
    v-if="hasAffixes"
  )
    slot(name="prefix")
  .dito-button__text(
    v-if="text || hasAffixes"
  ) {{ text || '' }}
    slot
  .dito-button__suffix(
    v-if="hasAffixes"
  )
    slot(name="suffix")
</template>

<script>
import { hasSlotContent } from '../utils/vue.js'

export default {
  inheritAttrs: false,

  props: {
    type: { type: String, default: 'button' },
    text: { type: String, default: null },
    title: { type: String, default: null },
    disabled: { type: Boolean, default: false }
  },

  computed: {
    hasAffixes() {
      return (
        hasSlotContent(this.$slots.prefix) ||
        hasSlotContent(this.$slots.suffix)
      )
    },

    classes() {
      return this.$attrs.class
    },

    attributes() {
      const { class: _, ...attributes } = this.$attrs
      return attributes
    }
  }
}
</script>
