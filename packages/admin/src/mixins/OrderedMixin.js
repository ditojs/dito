// @vue/component
export default {
  data() {
    return {
      dragging: false
    }
  },

  methods: {
    onStartDrag() {
      this.dragging = true
    },

    onEndDrag(event, list = this.value, schema = this.schema) {
      this.dragging = false
      const start = Math.min(event.oldIndex, event.newIndex)
      this.updateOrder(list, schema, start)
    },

    updateOrder(list = this.value, schema = this.schema, start = 0) {
      const {
        draggable: {
          order
        } = {}
      } = schema
      if (order) {
        // Reorder the changed entries by their order key.
        // TODO: Make this work with paginated lists, where we need to offest
        // by the start index.
        const offset = 0
        // Detect if no order values were set, and change `start` accordingly.
        while (start > 0 && list[start][order] == null) {
          start--
        }
        for (let i = start; i < list.length; i++) {
          list[i][order] = i + offset
        }
      }
      return list
    }
  }
}
