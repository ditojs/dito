// Derived from ATUI, and further extended: https://aliqin.github.io/atui/

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
      @mouseenter="onHover"
      @mouseleave="onHover"
    )
      slot(name="trigger")
    .dito-trigger(
      v-else-if="trigger === 'focus' || trigger === 'always'"
      ref="trigger"
      :class="triggerClass"
    )
      slot(name="trigger")
    transition(:name="transition")
      .dito-popup(
        v-if="trigger === 'hover'"
        ref="popup"
        v-show="showPopup"
        :class="popupClass"
        :style="popupStyle"
        @mouseenter="onHover"
        @mouseleave="onHover"
      )
        slot(name="popup")
      .dito-popup(
        v-else
        ref="popup"
        v-show="showPopup"
        :class="popupClass"
        :style="popupStyle"
      )
        slot(name="popup")
</template>

<style lang="sass">
  @import 'transitions/index'

  .dito-trigger-container
    position: relative

  .dito-trigger-disabled
    color: #ccc
    border-color: #e6e6e6
    cursor: not-allowed
    *
      cursor: not-allowed !important
      +user-select(none)
      &:focus
        box-shadow: none !important

  .dito-popup
    position: absolute
    top: 0
    left: 0
    z-index: 1000
</style>

<script>
import { isString, hyphenate } from '@ditojs/utils'
import { addEvent, addEvents } from '../utils'

export default {
  props: {
    trigger: {
      type: String,
      default: 'click'
    },
    transition: {
      type: String,
      default: 'slide'
    },
    placement: {
      type: String,
      default: 'bottom'
    },
    show: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    },
    target: {
      type: [String, HTMLElement],
      default: null
    },
    customClass: {
      type: String,
      default: null
    },
    zIndex: {
      type: Number,
      default: 0
    },
    keepInView: {
      type: Boolean,
      default: true
    },
    hideWhenClickOutside: {
      type: Boolean,
      default: true
    },
    alwaysShow: {
      type: Boolean,
      default: false
    },
    cover: {
      type: Boolean,
      default: false
    },
    hideDelay: {
      type: Number,
      default: 0
    }
  },

  data() {
    return {
      showPopup: this.show,
      popupPlacement: this.placement
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

    showPopup(newVal, oldVal) {
      if (!newVal !== !oldVal) {
        this.$emit('update:show', newVal)
        if (newVal) {
          this.$nextTick(() => this.updatePosition())
        }
      }
    }
  },

  mounted() {
    const { trigger, popup } = this.$refs
    if (this.trigger === 'focus') {
      const target = trigger.querySelector('input, textarea')
      if (target) {
        this.focusEvents = addEvents(target, {
          focus: () => {
            this.showPopup = true
          },
          blur: () => {
            this.showPopup = false
          }
        })
      }
    }

    if (this.hideWhenClickOutside && !this.alwaysShow) {
      this.closeEvent = addEvent(window, 'click', event => {
        if (
          !popup.contains(event.target) &&
          !trigger.contains(event.target)
        ) {
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

  beforeDestroy() {
    if (this.focusEvents) {
      this.focusEvents.remove()
    }
    if (this.focusEvents) {
      this.closeEvent.remove()
    }
    this.mouseLeaveTimer = null
  },

  methods: {
    updatePosition() {
      const { popup, trigger } = this.$refs
      if (this.show && popup.offsetWidth === 0) {
        setTimeout(() => this.updatePosition(), 0)
        return
      }

      const target = isString(this.target)
        ? this.$refs[this.target]
        : this.target
      if (target) {
        // Actual resize the popup's first child, so they can set size limits.
        const el = target === popup ? trigger : popup.firstChild
        el.style.width = window.getComputedStyle(target).width
      }

      const bounds = (target || trigger).getBoundingClientRect()
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
      if (target && target !== trigger) {
        const triggerBounds = trigger.getBoundingClientRect()
        left += triggerLeft - triggerBounds.left
        top += triggerTop - triggerBounds.top
      }
      popup.style.left = `${left}px`
      popup.style.top = `${top}px`

      this.$emit('update-position', {
        trigger,
        popup,
        placement: this.popupPlacement
      })
    },

    onClick() {
      if (!this.disabled) {
        this.showPopup = !this.showPopup
      }
    },

    onHover(event) {
      if (!this.disabled) {
        if (this.mouseLeaveTimer) {
          this.mouseLeaveTimer = clearTimeout(this.mouseLeaveTimer)
        }
        if (event.type === 'mouseenter') {
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
