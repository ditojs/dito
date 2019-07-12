<template lang="pug">
  // Render the label even if it's empty, when a specific tag (e.g. button) is
  // specified.
  component.dito-label(
    v-if="text || tag"
    :is="tag || 'div'"
    v-on="$listeners"
  )
    slot(name="prefix")
      span.dito-label-prefix(v-if="prefix") {{ prefix }}
    label(:for="dataPath") {{ text }}
    slot(name="suffix")
      span.dito-label-suffix(v-if="suffix") {{ suffix }}
</template>

<style lang="sass">
  .dito-label
    // In order for ellipsis to work on labels without affecting other layout,
    // we need to position it absolutely inside its container.
    margin: 0 0 $form-spacing-half 0
    position: relative
    label
      display: inline
      cursor: inherit
      white-space: nowrap
      font-weight: bold
    .dito-label-prefix::after,
    .dito-label-suffix::before
      content: '\00a0'
    &.dito-width-fill
      // Crop labels that are too large when component fills available space
      label
        position: absolute
        overflow: hidden
        text-overflow: ellipsis
        left: 0
        right: 0
      &::after
        // Since <label> uses `position: absolute`, add `content: '&nbsp;'`
        // on its parent to enforce the right text height in the container
        content: '\00a0'
  .dito-schema-compact .dito-label
    display: inline-block
    // To align with content in selects:
    padding: ($input-padding-ver + $border-width) 0.35em 0 0
    label
      position: relative
      &::after
        content: ':'
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { isObject } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-label', {
  props: {
    tag: { type: String, default: null },
    dataPath: { type: String, required: true },
    label: { type: [String, Object], required: true }
  },

  computed: {
    text() {
      const { label } = this
      return isObject(label) ? label?.text : label
    },

    prefix() {
      const { label } = this
      return isObject(label) ? label?.prefix : null
    },

    suffix() {
      const { label } = this
      return isObject(label) ? label?.suffix : null
    }
  }
})

</script>
