import ItemMixin from './ItemMixin.js'
import { UseSortable } from '@vueuse/integrations/useSortable/component'

// @vue/component
export default {
  mixins: [ItemMixin],
  components: { UseSortable },

  data() {
    return {
      dragging: false
    }
  },

  methods: {
    getSortableOptions(draggable, fallback = false) {
      return {
        animation: 150,
        // TODO: This is broken in VueSortable, always enable it for now.
        // disabled: !draggable,
        handle: '.dito-button-drag',
        dragClass: 'dito-sortable-active',
        chosenClass: 'dito-sortable-chosen',
        ghostClass: 'dito-sortable-ghost',
        fallbackClass: 'dito-sortable-fallback',
        forceFallback: fallback,
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
