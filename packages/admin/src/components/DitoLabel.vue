<template lang="pug">
  // Render the label even if it's empty, when a specific tag (e.g. button) is
  // specified.
  component.dito-label(
    v-if="text || collapsible"
    :is="tag"
    v-on="listeners"
  )
    .dito-chevron(
      v-if="collapsible"
      :class="{ 'dito-opened': !collapsed }"
    )
    span.dito-label-prefix(v-if="prefix") {{ prefix }}
    label(:for="dataPath") {{ text }}
    span.dito-label-suffix(v-if="suffix") {{ suffix }}
    slot(name="edit-buttons")
</template>

<style lang="sass">
  .dito-label
    --label-padding: 0
    padding: var(--label-padding)
    margin: 0 0 $form-spacing-half 0
    position: relative
    display: flex
    // Vertically center all items in the label, e.g. chevron, edit-buttons.
    align-items: center
    // Clear button styles when used as `button.dito-label`:
    background: none
    border: 0
    label
      cursor: inherit
      font-weight: bold
      white-space: nowrap
    .dito-label-prefix,
    .dito-label-suffix
      +ellipsis
      text-align: left
      &:nth-last-child(2)
        // To stretch either label or .dito-label-suffix to full available width
        flex: 1 1 auto
    .dito-label-prefix::after,
    .dito-label-suffix::before
      content: '\00a0'
    .dito-buttons
      // Move the label padding inside .dito-buttons, so that it captures all
      // near mouse events:
      margin: calc(var(--label-padding) * -1)
      margin-left: 0
      padding: var(--label-padding)
    &.dito-width-fill
      width: 100%
      // In order for ellipsis to work on labels without affecting other layout,
      // we need to position it absolutely inside its container.
      label
        +ellipsis
        position: absolute
        left: 0
        right: 0
      &::after
        // Since <label> uses `position: absolute`, add `content: '&nbsp;'`
        // on its parent to enforce the right text height in the container
        content: '\00a0'
  .dito-schema-compact
    .dito-label
      // Display compact labels as inline-blocks, with ': ' appended to them:
      display: inline-block
      label::after
        content: ':\00a0'
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { isObject } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-label', {
  props: {
    label: { type: [String, Object], default: null },
    dataPath: { type: String, default: null },
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false }
  },

  computed: {
    tag() {
      return this.collapsible ? 'button' : 'div'
    },

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
    },

    listeners() {
      return {
        ...(this.collapsible && {
          click: () => this.$emit('expand', this.collapsed)
        })
      }
    }
  }
})

</script>
