<template lang="pug">
//- Firefox doesn't start dragging from a <button>, so the handle is an <a>,
//- focusable through `tabindex` for the moves by keyboard.
DitoButton(
  ref="handle"
  as="a"
  role="button"
  :verb="verbs.drag"
  :disabled="disabled"
  :tabindex="disabled ? -1 : 0"
  aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
  @keydown.alt.up.prevent="move(-1)"
  @keydown.alt.down.prevent="move(1)"
)
</template>

<script>
import { computed, nextTick, useTemplateRef } from 'vue'
import { DitoButton } from '@ditojs/ui/src'
import { useServices } from '../composables/useSchemaContext.ts'
import { getVerbs } from '../utils/services.ts'

// The handle that items are dragged by, see `useSortable()`. With the keyboard,
// Alt+ArrowUp and Alt+ArrowDown move the item by emitting `move` with the
// delta of its index, which the owner of the list applies.
export default {
  name: 'DitoDragHandle',
  components: { DitoButton },
  emits: ['move'],

  props: {
    disabled: { type: Boolean, default: false }
  },

  setup(props, { emit }) {
    const services = useServices()
    const handle = useTemplateRef('handle')
    return {
      verbs: computed(() => getVerbs(services)),

      async move(delta) {
        if (!props.disabled) {
          emit('move', delta)
          // Moving the item can move the handle's element in the DOM, which
          // loses its focus.
          await nextTick()
          handle.value.$el.focus()
        }
      }
    }
  }
}
</script>
