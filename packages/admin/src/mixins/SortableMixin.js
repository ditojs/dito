// @vue/component
export default {
  data() {
    return {
      isDragging: false
    }
  },

  methods: {
    getDraggableOptions(
      forceFallback = window.dito.settings?.forceDragFallback ?? false
    ) {
      const prefix = 'dito-draggable'
      return {
        animation: 150,
        handle: '.dito-button--drag',
        dragClass: `${prefix}__drag`,
        chosenClass: `${prefix}__chosen`,
        ghostClass: `${prefix}__ghost`,
        fallbackClass: `${prefix}__fallback`,
        forceFallback,
        onStart: this.onStartDrag,
        onEnd: this.onEndDrag
      }
    },

    onStartDrag() {
      this.isDragging = true
    },

    onEndDrag({ oldIndex, newIndex }) {
      this.isDragging = false
      if (oldIndex !== newIndex) {
        this.onChange()
      }
    }
  }
}
