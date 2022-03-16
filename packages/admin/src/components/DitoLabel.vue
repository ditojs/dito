<template lang="pug">
  component.dito-label(
    v-if="text || collapsible"
    :is="tag"
    v-on="listeners"
    :class="{ 'dito-active': isActive }"
  )
    .dito-chevron(
      v-if="collapsible"
      :class="{ 'dito-opened': !collapsed }"
    )
    dito-element.dito-label-prefix(
      v-for="(prefix, index) of prefixes"
      tag="span"
      :key="`prefix-${index}`"
      :content="prefix"
    )
    label(:for="dataPath" v-html="text")
    dito-element.dito-label-suffix(
      v-for="(suffix, index) of suffixes"
      tag="span"
      :key="`suffix-${index}`"
      :content="suffix"
    )
    slot(name="edit-buttons")
</template>

<style lang="sass">
  .dito-label
    --label-padding: 0
    // For buttons and chevron to align right:
    display: flex
    position: relative
    // Vertically center all items in the label, e.g. chevron, edit-buttons.
    align-items: center
    padding: var(--label-padding)
    margin: 0 0 $form-spacing-half 0

    label
      display: inline
      cursor: inherit
      font-weight: bold
      white-space: nowrap

    label,
    .dito-label-prefix,
    .dito-label-suffix
      &:nth-last-child(2)
        // To stretch either label or .dito-label-suffix to full available width
        // so that buttons always appear right-aligned:
        flex: 1 1 auto
      &::after
        content: '\a0' // &nbps;

    .dito-label-prefix,
    .dito-label-suffix
      +user-select(none)
      +ellipsis

    .dito-buttons
      // Move the label padding inside .dito-buttons, so that it captures all
      // near mouse events:
      margin: calc(-1 * var(--label-padding))
      margin-left: 0
      padding: var(--label-padding)

    &.dito-width-fill
      width: 100%
      // In order for ellipsis to work on labels without affecting other layout,
      // we need to position it absolutely inside its container.
      label
        +ellipsis
        position: absolute
        max-width: 100%
      &::after
        // Since <label> uses `position: absolute`, set content to a zero-width
        // space on its parent to enforce the right text height in the container
        content: '\200b' // zero-width space

  a.dito-label
    &:hover
      .dito-chevron
        color: $color-darker
    &:focus:not(:active):not(.dito-active)
      .dito-chevron
        -webkit-text-stroke: $border-width $color-active

  // Display labels in compact schema as inline-blocks, to allow compact layouts
  // with `width: 'auto'` elements:
  // TODO: Find a better way to control this behavior.
  .dito-schema-compact
    > .dito-schema-content
      > .dito-pane
        > .dito-container
          > .dito-label:not(.dito-label-component)
            display: inline-block
</style>

<script>
import DitoComponent from '../DitoComponent.js'
import { isObject, asArray } from '@ditojs/utils'

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
      return this.collapsible ? 'a' : 'div'
    },

    text() {
      const { label } = this
      return isObject(label) ? label?.text : label
    },

    prefixes() {
      return asArray(this.label?.prefix)
    },

    suffixes() {
      return asArray(this.label?.suffix)
    },

    listeners() {
      return {
        ...(this.collapsible && {
          click: this.onClick
        })
      }
    },

    isActive() {
      return this.appState.activeLabel === this
    }
  },

  methods: {
    onClick() {
      this.appState.activeLabel = this
      this.$emit('expand', this.collapsed)
    }
  }
})

</script>
