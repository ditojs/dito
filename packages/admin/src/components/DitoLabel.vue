<template lang="pug">
  // Render the label even if it's empty, when a specific tag (e.g. button) is
  // specified.
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
    padding: var(--label-padding)
    margin: 0 0 $form-spacing-half 0
    position: relative
    // Vertically center all items in the label, e.g. chevron, edit-buttons.
    align-items: center
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
        content: '\00a0'
    .dito-label-prefix,
    .dito-label-suffix
      +ellipsis
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
  button.dito-label
    // Clear button styles:
    text-align: left
    background: none
    border: 0
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
      > .dito-components
        > .dito-component-container
          > .dito-label
            display: inline-block
</style>

<script>
import DitoComponent from '@/DitoComponent'
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
      return this.collapsible ? 'button' : 'div'
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
          click: this.onClick,
          mouseup: this.onMouseUp
        })
      }
    },

    isActive() {
      return this.appState.activeLabel === this
    }
  },

  methods: {
    onClick() {
      this.$emit('expand', this.collapsed)
    },

    onMouseUp(event) {
      this.appState.activeLabel = this
      // Prevent DitoRoot's document 'mouseup' event from clearing activeLabel:
      event.stopPropagation()
    }
  }
})

</script>
