import ItemMixin from '@/mixins/ItemMixin'

// @vue/component
export default {
  mixins: [ItemMixin],

  data() {
    return {
      dragging: false
    }
  },

  methods: {
    onStartDrag() {
      this.dragging = true
    },

    onEndDrag({ oldIndex, newIndex }, sourceSchema = this.schema) {
      this.dragging = false
      if (oldIndex !== newIndex) {
        // When items are reordered, the components and dataProcessers
        // registered by their data paths need to be updated as well:
        this.schemaComponent._reorderDataPaths(
          this.getItemDataPath(sourceSchema),
          oldIndex,
          newIndex
        )
        this.onChange()
      }
    },

    updateOrder(list, schema, draggable, paginationRange) {
      // NOTE: This mixin requires the component to define `this.draggable`.
      // TODO: Rename to a more meaningfull name, e.g. `orderKey` or
      // `orderProperty`.
      const order = draggable?.order
      if (order) {
        // Reorder the changed entries by their order key, taking pagination
        // offsets into account:
        const offset = paginationRange?.[0] || 0
        for (let i = 0; i < list.length; i++) {
          list[i][order] = i + offset
        }
      }
      return list
    }
  }
}
