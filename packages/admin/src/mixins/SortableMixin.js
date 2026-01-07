// @vue/component
export default {
  data() {
    return {
      isDragging: false
    }
  },

  methods: {
    getDraggableOptions(forceFallback = false) {
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
    },

    updateOrder(sourceSchema, list, paginationRange) {
      const { orderKey } = sourceSchema
      if (orderKey) {
        // Reorder the changed entries by their order key, taking pagination
        // offsets into account:
        const offset = paginationRange?.[0] || 0
        for (let i = 0; i < list.length; i++) {
          list[i][orderKey] = i + offset
        }
      }
      return list
    }
  }
}
