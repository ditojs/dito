<template lang="pug">
//- The handle that resizes the height of an element, by dragging it with the
//- pointer or with the arrow keys while it is focused, see `dragResize.js`.
.dito-resize(
  tabindex="0"
  role="separator"
  aria-orientation="horizontal"
  aria-label="Resize"
  @pointerdown.stop.prevent="onPointerDown"
  @keydown="onKeyDown"
)
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { startDragResize, resizeByArrowKey } from '../utils/dragResize.js'

// Emits `resize` with each new height of the element in pixels, which the
// owner of the element applies.
// @vue/component
export default DitoComponent.component('DitoResizeHandle', {
  emits: ['resize'],

  props: {
    // Returns the element to resize, which is measured at the start of each
    // resize.
    getElement: { type: Function, required: true }
  },

  methods: {
    onPointerDown(event) {
      startDragResize(event, this.getResizeOptions())
    },

    onKeyDown(event) {
      resizeByArrowKey(event, this.getResizeOptions())
    },

    getResizeOptions() {
      return {
        element: this.getElement(),
        onResize: height => this.$emit('resize', height)
      }
    }
  }
})
</script>
