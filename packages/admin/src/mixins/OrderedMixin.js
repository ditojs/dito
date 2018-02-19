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
      const { orderKey } = schema
      if (orderKey) {
        // Reorder the changed children by their orderKey.
        let start = Math.min(event.oldIndex, event.newIndex)
        // Detect if no order values were set, and change `start` accordingly.
        while (start > 0 && list[start][orderKey] == null) {
          start--
        }
        for (let i = start; i < list.length; i++) {
          list[i][orderKey] = i
        }
      }
    }
  }
}
