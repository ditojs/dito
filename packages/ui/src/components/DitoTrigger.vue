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
      .dito-trigger(:class="{ 'dito-trigger--disabled': disabled }")
        slot(name="trigger")
    //- No portal, so that the styles apply. The popup is fixed, so that
    //- scrolling panels don't clip it:
    PopoverContent.dito-popup(
      :class="popupClass"
      :side="sideAndAlign.side"
      :align="sideAndAlign.align"
      :sideOffset="0"
      :avoidCollisions="keepInView"
      positionStrategy="fixed"
      @open-auto-focus="onOpenAutoFocus"
      @close-auto-focus="$emit('closed')"
    )
      slot(name="popup")
</template>

<script>
import { PopoverAnchor, PopoverContent, PopoverRoot } from 'reka-ui'
import { getSideAndAlign } from '../utils/trigger'

// A popup at the content of the `trigger` slot, built on reka-ui's `Popover`.
// reka-ui's `PopoverTrigger` in the slot opens it, see `docs/api/ui.md`. The
// popup takes the focus, first on its element with `data-autofocus`, and
// returns it to the button when it closes. `closed` is emitted once the popup
// is removed, after its animation, and the focus has moved on.
export default {
  components: { PopoverAnchor, PopoverContent, PopoverRoot },
  emits: ['update:show', 'closed'],

  props: {
    // The name of the transition of the popup, or `null` to show it at once.
    transition: { type: String, default: 'slide' },
    placement: { type: String, default: 'bottom' },
    show: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    // An element to place the popup at, instead of the trigger.
    target: { type: HTMLElement, default: null },
    keepInView: { type: Boolean, default: true },
    // Whether the popup's first child takes on the width of the target.
    matchTargetWidth: { type: Boolean, default: true }
  },

  data() {
    return {
      showPopup: this.show
    }
  },

  computed: {
    sideAndAlign() {
      return getSideAndAlign(this.placement)
    },

    reference() {
      return this.target ?? undefined
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

    showPopup(show) {
      this.$emit('update:show', show)
    }
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

    setShow(show) {
      if (show) {
        this.open()
      } else {
        this.close()
      }
    },

    onOpenAutoFocus(event) {
      const element = event.target.querySelector('[data-autofocus]')
      if (element) {
        event.preventDefault()
        element.focus()
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';
@import '../styles/transitions';

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

  &--match-width > :first-child {
    width: var(--reka-popover-trigger-width);
  }
}
</style>
