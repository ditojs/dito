// Components that sort a list of their data by dragging provide it as
// `listEntry`, see `ListEntry`, and move its items through their data model.
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

    // Moves the item by `delta` positions, see `DitoDragHandle`.
    moveItem(item, delta) {
      const index = this.listEntry.list.indexOf(item)
      this.moveSortableItem(index, index + delta)
    },

    moveSortableItem(from, to) {
      const { listEntry } = this
      const { length } = listEntry.list
      if (from >= 0 && from !== to && to >= 0 && to < length) {
        this.dataModel.move(listEntry, from, to)
        this.onChange()
      }
    },

    onStartDrag() {
      this.isDragging = true
    },

    // The reordered list that `DitoDraggable` emits is ignored, as the item
    // moves in place.
    onEndDrag({ oldIndex, newIndex }) {
      this.isDragging = false
      this.moveSortableItem(oldIndex, newIndex)
    }
  }
}
