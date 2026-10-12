<template lang="pug">
//- The sortable is always rendered, also when not `draggable`, so that the
//- children aren't remounted when `draggable` changes.
UseSortable.dito-draggable(
  ref="sortable"
  :class="{ 'dito-draggable--dragging': isDragging }"
  :as="as"
  :modelValue="modelValue"
  :options="sortableOptions"
  @update:modelValue="$emit('update:modelValue', $event)"
)
  slot
</template>

<script>
import { ref, useTemplateRef, watch } from 'vue'
import { UseSortable } from '@vueuse/integrations/useSortable/component'
import Sortable from 'sortablejs'
import { useDomEvents } from '../composables/useDomEvents.ts'

export default {
  name: 'DitoDraggable',
  components: { UseSortable },
  emits: ['update:modelValue'],

  props: {
    modelValue: { type: Array, required: true },
    as: { type: String, default: 'div' },
    options: { type: Object, required: true },
    draggable: { type: Boolean, default: true }
  },

  setup(props) {
    const { domOn } = useDomEvents()
    const isDragging = ref(false)
    // The document handlers that clear `isDragging` after dragging:
    let dragEndHandlers = null

    const removeDragEndHandlers = () => {
      dragEndHandlers?.remove()
      dragEndHandlers = null
    }

    const onMouseAfterDragEnd = () => {
      isDragging.value = false
      removeDragEndHandlers()
    }

    // `UseSortable` reads its options only once when it's mounted: Delegate to
    // the current `options`, and toggle `disabled` in the watcher below.
    const sortableOptions = {
      ...props.options,
      disabled: !props.draggable,

      onStart(event) {
        props.options.onStart?.(event)
        isDragging.value = true
        removeDragEndHandlers()
      },

      onEnd(event) {
        props.options.onEnd?.(event)
        // Keep `isDragging` true until the next mouse interaction so that
        // confused hover states are cleared before removing the hover catcher.
        removeDragEndHandlers()
        dragEndHandlers = domOn(document, {
          mousedown: onMouseAfterDragEnd,
          mousemove: onMouseAfterDragEnd,
          mouseleave: onMouseAfterDragEnd
        })
      }
    }

    // Toggle the `Sortable` instance that `UseSortable` created on its element:
    const sortable = useTemplateRef('sortable')
    watch(
      () => props.draggable,
      draggable => {
        const element = sortable.value?.$el
        if (element instanceof HTMLElement) {
          Sortable.get(element)?.option('disabled', !draggable)
        }
      }
    )

    return { isDragging, sortableOptions }
  }
}
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
