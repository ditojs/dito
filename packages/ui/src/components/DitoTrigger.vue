<template lang="pug">
.dito-trigger-container
  PopoverRoot(
    :open="showPopup"
    @update:open="setShow"
  )
    PopoverAnchor(
      asChild
      :reference="reference"
    )
      .dito-trigger(
        ref="trigger"
        :class="{ 'dito-trigger--disabled': disabled }"
        @focusin="onFocusIn"
        @focusout="onFocusOut"
        @mousedown="onTriggerMouseDown"
        @keydown="onKeyDown"
      )
        slot(name="trigger")
    //- No portal, so that the styles apply. The popup is fixed, so that
    //- scrolling panels don't clip it:
    PopoverContent.dito-popup(
      ref="popup"
      :class="popupClass"
      :side="side"
      :align="align"
      :sideOffset="0"
      :avoidCollisions="keepInView"
      positionStrategy="fixed"
      @open-auto-focus.prevent
      @close-auto-focus.prevent
      @interact-outside="onInteractOutside"
      @focusout="onFocusOut"
      @mousedown="onPopupMouseDown"
      @keydown="onKeyDown"
    )
      slot(name="popup")
</template>

<script>
import { PopoverAnchor, PopoverContent, PopoverRoot } from 'reka-ui'
import { getTarget } from '../utils/trigger'

// A popup at the input in the `trigger` slot, built on reka-ui's `Popover`. It
// opens when the input gets the focus, and closes when the focus leaves both
// the trigger and the popup. Clicks in the popup keep the focus in the input,
// except on its fields. `placement` is a side and an alignment, e.g.
// `bottom-left`, and `target` an element to place the popup at instead.
export default {
  components: { PopoverAnchor, PopoverContent, PopoverRoot },
  emits: ['update:show'],

  props: {
    // The name of the transition of the popup, or `null` to show it at once.
    transition: { type: String, default: 'slide' },
    placement: { type: String, default: 'bottom' },
    show: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    target: { type: [String, HTMLElement], default: null },
    keepInView: { type: Boolean, default: true },
    // Whether the popup's first child takes on the width of the target.
    matchTargetWidth: { type: Boolean, default: true }
  },

  data() {
    return {
      showPopup: this.show,
      reference: null
    }
  },

  computed: {
    side() {
      return this.placement.split('-')[0]
    },

    align() {
      // `bottom-right` lines up the right edges, `bottom` the left ones:
      const alignment = this.placement.split('-')[1]
      return (
        { right: 'end', bottom: 'end', center: 'center' }[alignment] ??
        'start'
      )
    },

    popupClass() {
      return {
        [`dito-popup--${this.transition}`]: !!this.transition,
        'dito-popup--match-width': this.matchTargetWidth
      }
    }
  },

  watch: {
    show(show) {
      this.showPopup = show
    },

    showPopup: {
      // Before the popup is removed, so that it still holds the focus:
      flush: 'pre',
      handler(show) {
        if (!show && this.isPopupFocused()) {
          // Don't lose the focus with the popup, e.g. after selecting a date
          // in a calendar with the keyboard.
          this.focusTriggerInput()
        }
        this.$emit('update:show', show)
      }
    },

    target: 'updateReference'
  },

  mounted() {
    this.updateReference()
  },

  methods: {
    open() {
      if (!this.disabled) {
        this.showPopup = true
      }
    },

    close() {
      this.showPopup = false
    },

    toggle() {
      this.setShow(!this.showPopup)
    },

    setShow(show) {
      if (show) {
        this.open()
      } else {
        this.close()
      }
    },

    // A `target` other than the trigger, resolved once mounted, as `$refs`
    // aren't reactive:
    updateReference() {
      const target = getTarget(this)
      this.reference = target && target !== this.$refs.trigger ? target : null
    },

    getPopupElement() {
      return this.$refs.popup?.$el ?? null
    },

    isPopupFocused() {
      return !!this.getPopupElement()?.matches(':focus-within')
    },

    getTriggerInput() {
      return this.$refs.trigger?.querySelector('input, textarea') ?? null
    },

    focusTriggerInput() {
      // The input's focus event would open the popup again, see
      // `onFocusIn()`. Focus events are dispatched synchronously.
      this.isFocusingTriggerInput = true
      try {
        this.getTriggerInput()?.focus()
      } finally {
        this.isFocusingTriggerInput = false
      }
    },

    onFocusIn(event) {
      if (
        !this.isFocusingTriggerInput &&
        isEditableControl(event.target)
      ) {
        this.open()
      }
    },

    // Only close once the focus leaves the trigger and the popup, e.g. when
    // tabbing out, but not when it moves between them:
    onFocusOut(event) {
      const element = event.relatedTarget
      if (
        !this.$refs.trigger?.contains(element) &&
        !this.getPopupElement()?.contains(element)
      ) {
        this.close()
      }
    },

    onInteractOutside(event) {
      // Clicks and focus in the trigger aren't outside of the popup:
      if (this.$refs.trigger?.contains(event.target)) {
        event.preventDefault()
      }
    },

    onTriggerMouseDown(event) {
      // Only controls take the focus, so that clicks elsewhere in the trigger,
      // e.g. on a preview, keep it in the input:
      if (!isFocusableControl(event.target)) {
        event.preventDefault()
      }
    },

    onPopupMouseDown(event) {
      // The fields of the popup take the focus, e.g. those of a color picker.
      // Everything else leaves it in the input:
      if (!isEditableControl(event.target)) {
        event.preventDefault()
      }
    },

    onKeyDown(event) {
      // Close the popup here, before `document` receives the event, and mark
      // Escape as handled, so it doesn't also close what contains the trigger,
      // e.g. dialogs. reka-ui then ignores the event:
      if (event.key === 'Escape' && this.showPopup) {
        event.preventDefault()
        this.close()
      }
    }
  }
}

function isFocusableControl(element) {
  return !!element.matches?.('input, textarea, select, button')
}

function isEditableControl(element) {
  return !!element.matches?.('input, textarea, select')
}
</script>

<style lang="scss">
@import '../styles/_imports';
@import '../styles/transitions';

.dito-trigger-container {
  position: relative;
}

.dito-trigger--disabled {
  color: $color-disabled;
  border-color: $border-color;
  cursor: default;

  * {
    cursor: default !important;
    @include user-select(none);

    &:focus {
      box-shadow: none;
    }
  }
}

// reka-ui gives the popup's z-index to the element that positions it, and
// waits for the animations of closing popups before it removes them:
.dito-popup {
  z-index: $z-index-popup;

  @each $transition in fade, slide, zoom {
    &--#{$transition} {
      &[data-state='open'] {
        animation: dito-#{$transition}-enter 0.15s $ease-out-quart;
      }

      &[data-state='closed'] {
        animation: dito-#{$transition}-leave 0.15s $ease-out-quart;
      }
    }
  }

  // Doubled, to override the widths of the children's own styles, e.g. of
  // vue-color's pickers:
  &#{&}--match-width > :first-child {
    width: var(--reka-popover-trigger-width);
  }
}
</style>
