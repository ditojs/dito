<template lang="pug">
//- Resize the height of an element by dragging, or with the arrow keys:
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

export default {
  emits: ['resize'],

  props: {
    // Measure the element at the start of each resize:
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
