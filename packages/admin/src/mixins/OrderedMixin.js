import ItemMixin from '../mixins/ItemMixin.js'

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
