<template lang="pug">
UseSortable.dito-draggable(
  v-if="draggable"
  :class="{ 'dito-draggable--dragging': isDragging }"
  :tag="tag"
  :modelValue="modelValue"
  :options="{ ...options, onStart, onEnd }"
  @update:modelValue="$emit('update:modelValue', $event)"
)
  slot
component(
  v-else
  :is="tag"
)
  slot
</template>

<script>
import DitoComponent from '../DitoComponent'
import DomMixin from '../mixins/DomMixin.js'
import { UseSortable } from '@vueuse/integrations/useSortable/component'

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
    tag: {
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

  methods: {
    onStart(event) {
      this.isDragging = true
      this.options.onStart?.(event)
      this.mouseEvents?.remove()
    },

    onEnd(event) {
      this.options.onEnd?.(event)
      // Keep `isDragging` true until the next mouse interaction so that
      // confused hover states are cleared before removing the hover catcher.
      this.mouseEvents = this.domOn(this.$el, {
        mousedown: this.onMouse,
        mousemove: this.onMouse,
        mouseleave: this.onMouse
      })
    },

    onMouse() {
      this.isDragging = false
      this.mouseEvents.remove()
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
