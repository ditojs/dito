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
    :aria-expanded="showPopup"
    @click="onClick"
  )
    slot(name="trigger")
  .dito-trigger(
    v-else-if="trigger === 'hover'"
    ref="trigger"
    :class="triggerClass"
    :aria-expanded="showPopup"
    @mouseenter="onHover(true)"
    @mouseleave="onHover(false)"
  )
    slot(name="trigger")
  .dito-trigger(
    v-else-if="trigger === 'focus' || trigger === 'always'"
    ref="trigger"
    :class="triggerClass"
    :aria-expanded="showPopup"
  )
    slot(name="trigger")
  Transition(:name="`dito-${transition}`")
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

// The number of times `updatePosition()` waits for the popup to be laid out.
const maxPositionRetryCount = 100

export default {
  emits: ['update:show'],

  props: {
    trigger: { type: String, default: 'click' },
    transition: { type: String, default: 'slide' },
    placement: { type: String, default: 'bottom' },
    show: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    target: { type: [String, HTMLElement], default: null },
    customClass: { type: String, default: null },
    zIndex: { type: Number, default: 0 },
    keepInView: { type: Boolean, default: true },
    hideWhenClickOutside: { type: Boolean, default: true },
    alwaysShow: { type: Boolean, default: false },
    cover: { type: Boolean, default: false },
    hideDelay: { type: Number, default: 0 }
  },

  data() {
    return {
      showPopup: this.show,
      popupPlacement: this.placement,
      focusEvents: null,
      closeEvents: null,
      popupEvents: null,
      blurTimer: null,
      mouseLeaveTimer: null,
      positionTimer: null
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
    },

    triggerTarget() {
      return getTarget(this)
    }
  },

  watch: {
    show(show) {
      this.showPopup = show || this.alwaysShow
    },

    showPopup(to, from) {
      if (to ^ from) {
        this.$emit('update:show', to)
        this.$nextTick(() => this.onShowPopup(to))
      }
    }
  },

  mounted() {
    const { trigger } = this.$refs
    if (this.trigger === 'focus') {
      this.focusEvents = this.addFocusEvents(this.triggerTarget ?? trigger)
    }

    if (this.showPopup) {
      // The `showPopup` watcher doesn't see popups that are shown initially.
      this.onShowPopup(true)
    } else if (this.alwaysShow) {
      this.showPopup = true
    }
  },

  created() {
    this.showPopup = this.show
  },

  unmounted() {
    this.focusEvents?.remove()
    this.removeCloseEvents()
    this.popupEvents?.remove()
    clearTimeout(this.positionTimer)
    clearTimeout(this.blurTimer)
    clearTimeout(this.mouseLeaveTimer)
  },

  methods: {
    isPopupFocused() {
      return !!this.$refs.popup?.matches(':focus-within')
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
              !this.triggerTarget?.contains(event.target)
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
        this.showPopup = false
      }
    },

    updatePosition(retryCount = 0) {
      const { trigger, popup } = this.$refs
      clearTimeout(this.positionTimer)
      this.positionTimer = null
      if (!popup || !this.showPopup) {
        // Unmounted or hidden in the meantime.
        return
      }
      if (this.show && popup.offsetWidth === 0) {
        // Wait for the popup to be laid out, but not forever, e.g. if the
        // trigger is in a hidden part of the page.
        if (retryCount < maxPositionRetryCount) {
          this.positionTimer = setTimeout(
            () => this.updatePosition(retryCount + 1),
            0
          )
        }
        return
      }

      const target = this.triggerTarget ?? trigger
      // Actually resize the popup's first child, so they can set size limits.
      const el = this.target === 'popup' ? trigger : popup.firstElementChild
      if (el) {
        el.style.width = getComputedStyle(target).width
      }

      const bounds = target.getBoundingClientRect()
      const triggerLeft = bounds.left + window.scrollX
      const triggerTop = bounds.top + window.scrollY
      const triggerWidth = bounds.width
      const triggerHeight = bounds.height
      const popupWidth = popup.offsetWidth
      const popupHeight = popup.offsetHeight

      let [part1, part2] = this.popupPlacement.split('-') || []
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
      let input

      return combineEvents(
        addEvents(targets, {
          focus: () => {
            this.showPopup = true
            clearTimeout(this.blurTimer)
          },

          blur: () => {
            // Use timeout to allow clicked inputs to grab focus
            this.blurTimer = setTimeout(() => {
              if (!this.isPopupFocused()) {
                this.showPopup = false
              }
            }, 0)
          }
        }),

        addEvents(parent, {
          mousedown: event => {
            if (!event.target.matches('input, textarea, button')) {
              event.preventDefault()
              event.stopPropagation()
            }
            if (!event.target.matches('.dito-button-clear')) {
              const trigger = this.triggerTarget ?? this.$refs.trigger
              // Mark trigger input as readonly so it can't loose focus while
              // user does other mouse-activities in popup.
              input = trigger.querySelector('input, textarea')
              if (input && !input.hasAttribute('readonly')) {
                input.setAttribute('readonly', 'true')
              } else {
                input = null
              }
            }
          },

          mouseup: event => {
            if (input) {
              // Give some time for other events to update input before it
              // becomes editable and still focused again.
              setTimeout(() => {
                input.removeAttribute('readonly')
                // Only bring the focus back from the popup, not if the focus
                // moved elsewhere in the meantime, e.g. by clicking outside.
                if (
                  !event.target.matches('input, textarea, button') &&
                  this.isPopupFocused()
                ) {
                  input.focus()
                }
                input = null
              }, 0)
            }
          }
        })
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
        this.updatePosition()
      } else {
        this.popupEvents?.remove()
        this.popupEvents = null
        this.removeCloseEvents()
      }
    },

    onClick() {
      if (!this.disabled) {
        this.showPopup = true
      }
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
