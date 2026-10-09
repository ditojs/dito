<template lang="pug">
//- Firefox doesn't start dragging from a <button>, so the handle is an <a>,
//- focusable through `tabindex` for the moves by keyboard.
DitoButton(
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
import { DitoButton } from '@ditojs/ui/src'
import DitoComponent from '../DitoComponent.js'

// The handle that items are dragged by, see `SortableMixin`. With the keyboard,
// Alt+ArrowUp and Alt+ArrowDown move the item by emitting `move` with the
// delta of its index, which the owner of the list applies.
// @vue/component
export default DitoComponent.component('DitoDragHandle', {
  components: { DitoButton },
  emits: ['move'],

  props: {
    disabled: { type: Boolean, default: false }
  },

  methods: {
    async move(delta) {
      if (!this.disabled) {
        this.$emit('move', delta)
        // Moving the item can move the handle's element in the DOM, which
        // loses its focus.
        await this.$nextTick()
        this.$el.focus()
      }
    }
  }
})
</script>
