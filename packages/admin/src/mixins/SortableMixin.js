import ItemMixin from './ItemMixin.js'

// @vue/component
export default {
  mixins: [ItemMixin],

  data() {
    return {
      dragging: false
    }
  },

  methods: {
    getSortableOptions(forceFallback = false) {
      return {
        animation: 150,
        handle: '.dito-button-drag',
        dragClass: 'dito-sortable-active',
        chosenClass: 'dito-sortable-chosen',
        ghostClass: 'dito-sortable-ghost',
        fallbackClass: 'dito-sortable-fallback',
        forceFallback,
        onStart: this.onStartDrag,
        onEnd: this.onEndDrag
      }
    },

    onStartDrag() {
      this.dragging = true
    },

    onEndDrag({ oldIndex, newIndex }) {
      this.dragging = false
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
