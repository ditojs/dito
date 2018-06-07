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
      const {
        draggable: {
          order
        } = {}
      } = schema
      if (order) {
        // Reorder the changed children by their order key.
        let start = Math.min(event.oldIndex, event.newIndex)
        // Detect if no order values were set, and change `start` accordingly.
        while (start > 0 && list[start][order] == null) {
          start--
        }
        for (let i = start; i < list.length; i++) {
          list[i][order] = i
        }
      }
    }
  }
}
