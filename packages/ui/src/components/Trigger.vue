<!-- Derived from ATUI, and further extended: https://aliqin.github.io/atui/ -->
<template lang="pug">
.dito-trigger-container
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
  Transition(:name="transition")
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
      popupEvents: null
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
    const { trigger, popup } = this.$refs
    if (this.trigger === 'focus') {
      this.focusEvents = this.addFocusEvents(this.triggerTarget ?? trigger)
    }

    if (this.hideWhenClickOutside && !this.alwaysShow) {
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

    if (this.alwaysShow) {
      this.showPopup = true
    }
  },

  created() {
    this.showPopup = this.show
  },

  unmounted() {
    this.focusEvents?.remove()
    this.closeEvents?.remove()
    this.popupEvents?.remove()
    this.mouseLeaveTimer = null
  },

  methods: {
    updatePosition() {
      const { trigger, popup } = this.$refs
      if (this.show && popup.offsetWidth === 0) {
        setTimeout(() => this.updatePosition(), 0)
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
        if (part1 === 'top') {
          if (triggerTop < popupHeight) {
            part1 = 'bottom'
          }
        } else if (part1 === 'bottom') {
          if (winHeight - triggerTop - triggerHeight < popupHeight) {
            part1 = 'top'
          }
        } else if (part1 === 'left') {
          if (triggerLeft < popupWidth) {
            part1 = 'right'
          }
        } else if (part1 === 'right') {
          if (winWidth - triggerLeft - triggerWidth < popupWidth) {
            part1 = 'left'
          }
        }

        if (part2 === 'top') {
          if (winHeight - triggerTop < popupHeight) {
            part2 = 'bottom'
          }
        } else if (part2 === 'bottom') {
          if (triggerTop + triggerHeight < popupHeight) {
            part2 = 'top'
          }
        } else if (part2 === 'left') {
          if (winWidth - triggerLeft < popupWidth) {
            part2 = 'right'
          }
        } else if (part2 === 'right') {
          if (triggerLeft + triggerWidth < popupWidth) {
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
      if (targets.length > 0) {
        let input

        return combineEvents(
          addEvents(targets, {
            focus: () => {
              this.showPopup = true
            },

            blur: () => {
              // Use timeout to allow clicked inputs to grab focus
              setTimeout(() => {
                if (!this.$el.matches(':has(:focus-within)')) {
                  this.showPopup = false
                }
              }, 0)
            }
          }),

          addEvents(parent, {
            mousedown: event => {
              if (!event.target.matches('input, textarea')) {
                event.preventDefault()
              }
              const trigger = this.triggerTarget ?? this.$refs.trigger
              if (parent !== trigger) {
                // Mark trigger input as readonly so it can't loose focus while
                // user does other mouse-activities in popup.
                input = trigger.querySelector('input, textarea')
                if (
                  input?.matches(':focus') &&
                  !input.hasAttribute('readonly')
                ) {
                  input.setAttribute('readonly', '')
                } else {
                  input = null
                }
              }
            },

            mouseup: () => {
              if (input) {
                // Give some time for other events to update input before it
                // becomes editable and still focused again.
                setTimeout(() => {
                  input.removeAttribute('readonly')
                  input.focus()
                  input = null
                }, 0)
              }
            }
          })
        )
      }
    },

    onShowPopup(show) {
      if (show) {
        if (this.trigger === 'focus') {
          this.popupEvents = this.addFocusEvents(this.$refs.popup)
        }
        this.updatePosition()
      } else {
        this.popupEvents?.remove()
        this.popupEvents = null
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
@import '../styles/transitions/index.scss';

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
  z-index: 1000;
}
</style>
