<template lang="pug">
//- The sortable is always rendered, also when not `draggable`, so that the
//- children aren't remounted when `draggable` changes, see `watch`.
UseSortable.dito-draggable(
  :class="{ 'dito-draggable--dragging': isDragging }"
  :as="as"
  :modelValue="modelValue"
  :options="sortableOptions"
  @update:modelValue="$emit('update:modelValue', $event)"
)
  slot
</template>

<script>
import DitoComponent from '../DitoComponent'
import DomMixin from '../mixins/DomMixin.js'
import { UseSortable } from '@vueuse/integrations/useSortable/component'
import Sortable from 'sortablejs'

// @vue/component
export default DitoComponent.component('DitoDraggable', {
  mixins: [DomMixin],
  components: { UseSortable },
  emits: ['update:modelValue'],

  props: {
    modelValue: {
      type: Array,
      required: true
    },
    as: {
      type: String,
      default: 'div'
    },
    options: {
      type: Object,
      required: true
    },
    draggable: {
      type: Boolean,
      default: true
    }
  },

  data() {
    return {
      mouseEvents: null,
      isDragging: false
    }
  },

  watch: {
    draggable(draggable) {
      this.getSortable()?.option('disabled', !draggable)
    }
  },

  created() {
    // `UseSortable` reads its options only once when it's mounted, so they're
    // built once here. The handlers call the handlers of the current
    // `options`, and `draggable` toggles the `disabled` option, see `watch`.
    this.sortableOptions = {
      ...this.options,
      disabled: !this.draggable,
      onStart: this.onStart,
      onEnd: this.onEnd
    }
  },

  methods: {
    // Returns the `Sortable` instance that `UseSortable` created on the
    // element.
    getSortable() {
      return this.$el instanceof HTMLElement ? Sortable.get(this.$el) : null
    },

    onStart(event) {
      this.options.onStart?.(event)
      this.isDragging = true
      this.mouseEvents?.remove()
    },

    onEnd(event) {
      this.options.onEnd?.(event)
      // Keep `isDragging` true until the next mouse interaction so that
      // confused hover states are cleared before removing the hover catcher.
      this.mouseEvents = this.domOn(document, {
        mousedown: this.onMouse,
        mousemove: this.onMouse,
        mouseleave: this.onMouse
      })
    },

    onMouse() {
      this.isDragging = false
      this.mouseEvents?.remove()
      this.mouseEvents = null
    }
  }
})
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-draggable {
  // Overlay a hover catcher while we're dragging to prevent hover states from
  // getting stuck / confused. Safari struggles with this, so disable it there.
  @include browser-query(('chrome', 'firefox')) {
    &:has(&__chosen),
    &--dragging {
      > * {
        position: relative;

        > :first-child::after {
          content: '';
          position: absolute;
          inset: 0;
        }
      }
    }
  }

  &__fallback {
    filter: drop-shadow(0 2px 4px $color-shadow);

    // Nested <td> need to also switch to `display: flex` style during dragging.
    &,
    td {
      display: flex;

      > * {
        flex: 1;
      }
    }
  }
}
</style>
