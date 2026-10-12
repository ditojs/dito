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
import { startDragResize, resizeByArrowKey } from '../utils/dragResize.js'

// Emits `resize` with each new height of the element in pixels, which the
// owner of the element applies.
export default {
  name: 'DitoResizeHandle',
  emits: ['resize'],

  props: {
    // Returns the element to resize, which is measured at the start of each
    // resize.
    getElement: { type: Function, required: true }
  },

  setup(props, { emit }) {
    const getResizeOptions = () => ({
      element: props.getElement(),
      onResize: height => emit('resize', height)
    })

    return {
      onPointerDown(event) {
        startDragResize(event, getResizeOptions())
      },

      onKeyDown(event) {
        resizeByArrowKey(event, getResizeOptions())
      }
    }
  }
}
</script>
