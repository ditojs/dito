<!-- Derived from ATUI, and further extended: https://aliqin.github.io/atui/ -->
<template lang="pug">
.dito-trigger-container(
  @keydown="onKeyDown"
)
  .dito-trigger(
    v-if="alwaysShow"
    ref="trigger"
    :class="triggerClass"
  )
    slot(name="trigger")
  .dito-trigger(
    v-else-if="trigger === 'click'"
    ref="trigger"
    :class="triggerClass"
    @click="onClick"
  )
    slot(name="trigger")
  .dito-trigger(
    v-else-if="trigger === 'hover'"
    ref="trigger"
    :class="triggerClass"
    @mouseenter="onHover(true)"
    @mouseleave="onHover(false)"
  )
    slot(name="trigger")
  .dito-trigger(
    v-else-if="trigger === 'focus' || trigger === 'always'"
    ref="trigger"
    :class="triggerClass"
  )
    slot(name="trigger")
  Transition(
    :name="transition ? `dito-${transition}` : undefined"
    :css="!!transition"
  )
    .dito-popup(
      v-if="trigger === 'hover'"
      v-show="showPopup"
      ref="popup"
      :class="popupClass"
      :style="popupStyle"
      @mouseenter="onHover(true)"
      @mouseleave="onHover(false)"
    )
      slot(
        v-if="showPopup"
        name="popup"
      )
    .dito-popup(
      v-else
      v-show="showPopup"
      ref="popup"
      :class="popupClass"
      :style="popupStyle"
    )
      slot(
        v-if="showPopup"
        name="popup"
      )
</template>

<script>
import { hyphenate } from '@ditojs/utils'
import { addEvents, combineEvents } from '../utils/event.js'
import { getTarget } from '../utils/trigger'

function isFocusableControl(element) {
  return !!element.matches?.('input, textarea, select, button')
}

function isEditableControl(element) {
  return !!element.matches?.('input, textarea, select')
}

export default {
  emits: ['update:show'],

  props: {
    trigger: { type: String, default: 'click' },
    // The name of the transition of the popup, or `null` to show it at once.
    transition: { type: String, default: 'slide' },
    placement: { type: String, default: 'bottom' },
    show: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    target: { type: [String, HTMLElement], default: null },
    customClass: { type: String, default: null },
    zIndex: { type: Number, default: 0 },
    keepInView: { type: Boolean, default: true },
    hideWhenClickOutside: { type: Boolean, default: true },
    // Whether the popup's first child takes on the width of the target.
    matchTargetWidth: { type: Boolean, default: true },
    alwaysShow: { type: Boolean, default: false },
    cover: { type: Boolean, default: false },
    hideDelay: { type: Number, default: 0 }
  },

  data() {
    return {
      showPopup: this.show,
      focusEvents: null,
      closeEvents: null,
      popupEvents: null,
      mouseLeaveTimer: null,
      targetResizeObserver: null
    }
  },

  computed: {
    triggerClass() {
      return {
        'dito-trigger-disabled': this.disabled
      }
    },

    popupClass() {
      const classes = {
        [`dito-popup-${hyphenate(this.placement)}`]: true
      }
      if (this.customClass) {
        classes[this.customClass] = true
      }
      return classes
    },

    popupStyle() {
      return this.zIndex ? `z-index: ${this.zIndex}` : ''
    }
  },

  watch: {
    show(show) {
      this.showPopup = show || this.alwaysShow
    },

    showPopup(to, from) {
      if (to ^ from) {
        if (!to && this.trigger === 'focus' && this.isPopupFocused()) {
          // Don't lose the focus with the popup, e.g. after selecting a date in
          // a calendar with the keyboard.
          this.focusTriggerInput()
        }
        this.$emit('update:show', to)
        this.$nextTick(() => this.onShowPopup(to))
      }
    },

    target() {
      if (this.$refs.trigger) {
        this.addTargetEvents()
        if (this.targetResizeObserver) {
          this.unobserveTargetSize()
          this.observeTargetSize()
        }
      }
    },

    placement() {
      this.$nextTick(() => this.updatePosition())
    }
  },

  mounted() {
    this.addTargetEvents()

    if (this.showPopup) {
      // The `showPopup` watcher doesn't see popups that are shown initially.
      this.onShowPopup(true)
    } else if (this.alwaysShow) {
      this.showPopup = true
    }
  },

  created() {
    this.showPopup = this.show
    // Whether `focusTriggerInput()` is moving the focus, see there.
    this.isFocusingTriggerInput = false
  },

  unmounted() {
    this.focusEvents?.remove()
    this.removeCloseEvents()
    this.popupEvents?.remove()
    this.unobserveTargetSize()
    clearTimeout(this.mouseLeaveTimer)
  },

  methods: {
    open() {
      if (!this.disabled) {
        this.showPopup = true
      }
    },

    close() {
      if (!this.alwaysShow) {
        this.showPopup = false
      }
    },

    toggle() {
      if (this.showPopup) {
        this.close()
      } else {
        this.open()
      }
    },

    // Returns the element that the popup is positioned at, resolving a `target`
    // given by ref name, which is only possible once mounted. This is why it
    // can't be a computed property: `$refs` aren't reactive.
    getTargetElement() {
      return getTarget(this) ?? this.$refs.trigger
    },

    isPopupFocused() {
      return !!this.$refs.popup?.contains(document.activeElement)
    },

    // Returns whether `element` is part of the trigger, its target or the
    // popup.
    containsElement(element) {
      return (
        !!element && (
          this.$el.contains(element) ||
          this.getTargetElement().contains(element)
        )
      )
    },

    getTriggerInput() {
      return this.getTargetElement()?.querySelector('input, textarea') ?? null
    },

    focusTriggerInput() {
      // The input's focus event would open the popup again, see
      // `addFocusEvents()`. Focus events are dispatched synchronously.
      this.isFocusingTriggerInput = true
      try {
        this.getTriggerInput()?.focus()
      } finally {
        this.isFocusingTriggerInput = false
      }
    },

    addTargetEvents() {
      this.focusEvents?.remove()
      this.focusEvents =
        this.trigger === 'focus'
          ? this.addFocusEvents(this.getTargetElement())
          : null
    },

    // Adds the events that close the popup while it is shown, see
    // `onShowPopup()`.
    addCloseEvents() {
      if (this.hideWhenClickOutside && !this.alwaysShow && !this.closeEvents) {
        const { trigger, popup } = this.$refs
        // Use 'mouseup' instead of 'click', since click appears to happen after
        // the DOM inside of popups could change in a way so that the check
        // `popup.contains(event.target)` would fail:
        this.closeEvents = addEvents(window, {
          mouseup: event => {
            if (
              this.showPopup &&
              !popup.contains(event.target) &&
              !trigger.contains(event.target) &&
              !this.getTargetElement().contains(event.target)
            ) {
              this.showPopup = false
            }
          },

          blur: () => {
            this.showPopup = false
          }
        })
      }
    },

    removeCloseEvents() {
      this.closeEvents?.remove()
      this.closeEvents = null
    },

    onKeyDown(event) {
      if (event.key === 'Escape' && this.showPopup && !this.alwaysShow) {
        // Don't let Escape also close what contains the trigger, e.g. dialogs.
        event.stopPropagation()
        this.close()
      }
    },

    // Positions the popup whenever the size of the target changes, which
    // includes the moment it is laid out, also if the popup is shown inside a
    // hidden part of the page that only becomes visible later. The target is
    // observed rather than the popup, since `updatePosition()` resizes the
    // popup, which would trigger the observer again.
    observeTargetSize() {
      if (!this.targetResizeObserver) {
        this.targetResizeObserver = new ResizeObserver(
          () => this.updatePosition()
        )
        this.targetResizeObserver.observe(this.getTargetElement())
      }
    },

    unobserveTargetSize() {
      this.targetResizeObserver?.disconnect()
      this.targetResizeObserver = null
    },

    updatePosition() {
      const { trigger, popup } = this.$refs
      if (!popup || !this.showPopup || popup.offsetWidth === 0) {
        // Unmounted, hidden, or not laid out yet, see `observeTargetSize()`.
        return
      }

      const target = this.getTargetElement()
      if (this.matchTargetWidth) {
        // Actually resize the popup's first child, so it can set size limits.
        const el = this.target === 'popup' ? trigger : popup.firstElementChild
        if (el) {
          el.style.width = getComputedStyle(target).width
        }
      }

      const bounds = target.getBoundingClientRect()
      const triggerLeft = bounds.left + window.scrollX
      const triggerTop = bounds.top + window.scrollY
      const triggerWidth = bounds.width
      const triggerHeight = bounds.height
      const popupWidth = popup.offsetWidth
      const popupHeight = popup.offsetHeight

      let [part1, part2] = this.placement.split('-')
      if (this.keepInView) {
        const winWidth = window.innerWidth
        const winHeight = window.innerHeight
        const roomAbove = triggerTop
        const roomBelow = winHeight - triggerTop - triggerHeight
        const roomLeft = triggerLeft
        const roomRight = winWidth - triggerLeft - triggerWidth
        // Flips the popup to the other side if it doesn't fit, but only if
        // there's more room there, so it doesn't move further out of view.
        const shouldFlip = (room, otherRoom, size) => (
          room < size && otherRoom > room
        )

        if (part1 === 'top') {
          if (shouldFlip(roomAbove, roomBelow, popupHeight)) {
            part1 = 'bottom'
          }
        } else if (part1 === 'bottom') {
          if (shouldFlip(roomBelow, roomAbove, popupHeight)) {
            part1 = 'top'
          }
        } else if (part1 === 'left') {
          if (shouldFlip(roomLeft, roomRight, popupWidth)) {
            part1 = 'right'
          }
        } else if (part1 === 'right') {
          if (shouldFlip(roomRight, roomLeft, popupWidth)) {
            part1 = 'left'
          }
        }

        // The alignments of the popup's edges with the trigger's edges.
        if (part2 === 'top') {
          if (
            shouldFlip(
              winHeight - triggerTop,
              triggerTop + triggerHeight,
              popupHeight
            )
          ) {
            part2 = 'bottom'
          }
        } else if (part2 === 'bottom') {
          if (
            shouldFlip(
              triggerTop + triggerHeight,
              winHeight - triggerTop,
              popupHeight
            )
          ) {
            part2 = 'top'
          }
        } else if (part2 === 'left') {
          if (
            shouldFlip(
              winWidth - triggerLeft,
              triggerLeft + triggerWidth,
              popupWidth
            )
          ) {
            part2 = 'right'
          }
        } else if (part2 === 'right') {
          if (
            shouldFlip(
              triggerLeft + triggerWidth,
              winWidth - triggerLeft,
              popupWidth
            )
          ) {
            part2 = 'left'
          }
        }
      }

      let left = 0
      let top = 0
      switch (part1) {
        case 'top':
          top -= popupHeight
          break
        case 'left':
          left -= popupWidth
          break
        case 'right':
          left += triggerWidth
          break
        case 'bottom':
          top += triggerHeight
          break
      }
      switch (part2) {
        case 'right':
          left -= popupWidth - triggerWidth
          break
        case 'bottom':
          top -= popupHeight - triggerHeight
          break
      }
      if (this.cover) {
        if (part1 === 'top') {
          top += triggerHeight
        } else if (part1 === 'bottom') {
          top -= triggerHeight
        }
      }
      if (target !== trigger) {
        const triggerBounds = trigger.getBoundingClientRect()
        left += triggerLeft - triggerBounds.left
        top += triggerTop - triggerBounds.top
      }
      popup.style.left = `${left}px`
      popup.style.top = `${top}px`
    },

    addFocusEvents(parent) {
      const targets = parent.querySelectorAll('input, textarea')
      // The trigger's input while it is marked readonly, see `mousedown`, and
      // the events that release it again.
      let lockedInput = null
      let releaseEvents = null

      const releaseInput = event => {
        const input = lockedInput
        lockedInput = null
        releaseEvents.remove()
        releaseEvents = null
        // Give some time for other events to update input before it becomes
        // editable and still focused again.
        setTimeout(() => {
          input.removeAttribute('readonly')
          // Only bring the focus back from the popup, not if the focus moved
          // elsewhere in the meantime, e.g. by clicking outside.
          if (!isFocusableControl(event.target) && this.isPopupFocused()) {
            input.focus()
          }
        }, 0)
      }

      // Only close once the focus leaves the trigger, its target and the
      // popup, e.g. when tabbing out, but not when it moves between them, e.g.
      // when tabbing into the popup. Blur events don't bubble, so capture them.
      const onBlur = event => {
        if (!this.containsElement(event.relatedTarget)) {
          this.close()
        }
      }
      parent.addEventListener('blur', onBlur, true)

      return combineEvents(
        addEvents(targets, {
          focus: () => {
            if (!this.isFocusingTriggerInput) {
              this.open()
            }
          }
        }),

        addEvents(parent, {
          mousedown: event => {
            const { target } = event
            const isInPopup = !!this.$refs.popup?.contains(target)
            // Controls take the focus, except for the buttons in the popup, so
            // that the focus stays in the trigger's input when using the mouse.
            const takesFocus = isInPopup
              ? isEditableControl(target)
              : isFocusableControl(target)
            if (!takesFocus) {
              event.preventDefault()
              event.stopPropagation()
            }
            // Mark the trigger's input as readonly so it can't lose focus
            // while the user does other mouse-activities in the popup, except
            // for the controls in the popup that take the focus themselves,
            // e.g. the fields of a color picker.
            if (!lockedInput && !(isInPopup && takesFocus)) {
              const input = this.getTriggerInput()
              if (input && !input.hasAttribute('readonly')) {
                input.setAttribute('readonly', 'true')
                lockedInput = input
                // Release the input wherever the mouse is released, also
                // outside of `parent`, e.g. after dragging in a color picker.
                releaseEvents = addEvents(window, { mouseup: releaseInput })
              }
            }
          }
        }),

        {
          remove() {
            parent.removeEventListener('blur', onBlur, true)
            releaseEvents?.remove()
            releaseEvents = null
            lockedInput?.removeAttribute('readonly')
            lockedInput = null
          }
        }
      )
    },

    onShowPopup(show) {
      // The popup may have been toggled again or unmounted in the meantime:
      if (show !== this.showPopup || !this.$refs.popup) return
      if (show) {
        if (this.trigger === 'focus') {
          this.popupEvents?.remove()
          this.popupEvents = this.addFocusEvents(this.$refs.popup)
        }
        this.addCloseEvents()
        this.observeTargetSize()
      } else {
        this.popupEvents?.remove()
        this.popupEvents = null
        this.removeCloseEvents()
        this.unobserveTargetSize()
      }
    },

    onClick() {
      this.toggle()
    },

    onHover(enter) {
      if (!this.disabled) {
        clearTimeout(this.mouseLeaveTimer)
        if (enter) {
          this.showPopup = true
        } else {
          if (this.hideDelay) {
            this.mouseLeaveTimer = setTimeout(() => {
              this.showPopup = false
            }, this.hideDelay)
          } else {
            this.showPopup = false
          }
        }
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';
@import '../styles/transitions';

.dito-trigger-container {
  position: relative;
}

.dito-trigger-disabled {
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

.dito-popup {
  position: absolute;
  top: 0;
  left: 0;
  z-index: $z-index-popup;
}
</style>
