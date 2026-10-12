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

export default {
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
          // Moving the item in the DOM loses the focus of the handle:
          await nextTick()
          handle.value.$el.focus()
        }
      }
    }
  }
}
</script>
