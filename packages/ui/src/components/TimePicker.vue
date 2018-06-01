// Derived from ATUI, and further extended: https://aliqin.github.io/atui/

<template lang="pug">
  trigger.dito-time-picker(
    ref="trigger"
    trigger="click"
    :show.sync="showPopup"
    v-bind="{ transition, placement, disabled, target }"
  )
    input.dito-input(
      slot="trigger"
      ref="input"
      :value="text"
      @keydown="onKeyDown"
      v-bind="{ placeholder, disabled }"
    )
    // icon(type="time"
    //   :color="disabled ? '#bfbfbf' : (text ? '#666' : '#bfbfbf')"
    // )
    .dito-time-picker-popup(
      slot="popup"
    )
      .dito-time-picker-panel
        ul.time-hours(
          ref="hours"
          @mouseover="selection = 0"
        )
          li(
            v-for="index in 24"
            v-if="!disabledHour(index - 1)"
            :class="{ selected: hours === index - 1 }"
            @click="hours = index - 1"
          ) {{ leftPad(index - 1) }}
      .dito-time-picker-panel
        ul.time-minute(
          ref="minutes"
          @mouseover="selection = 1"
        )
          li(
            v-for="index in 60"
            v-if="!disabledMinute(index - 1)"
            :class="{ selected: minutes === index - 1 }"
            @click="minutes = index - 1"
          ) {{ leftPad(index - 1) }}
      .dito-time-picker-panel
        ul.time-seconds(
          ref="seconds"
          @mouseover="selection = 2"
        )
          li(
            v-for="index in 60"
            v-if="!disabledSecond(index - 1)"
            :class="{ selected: seconds === index - 1 }"
            @click="seconds = index - 1"
          ) {{ leftPad(index - 1) }}
</template>

<style lang="sass">
  @import '../styles/index'
  .dito-time-picker
    .dito-input
      width: 100%

  .dito-time-picker-popup
    max-width: 160px
    margin-top: 2px

  $time-picker-line-height: 24px
  .dito-time-picker
    .dito-input
      cursor: pointer
      width: 100%
      .dito-icon-time
        display: block
        position: absolute
        top: 0
        right: 7px
        height: 100%

  .dito-time-picker-popup
    outline: none
    list-style: none
    background: $color-white
    border: $border-style
    border-radius: $border-radius
    box-shadow: $shadow-window
    overflow: hidden

  .dito-time-picker-popup .dito-time-picker-panel
    float: left
    border: 1px solid #e9e9e9 // TODO: $border-style
    border-width: 0 1px 0
    margin-left: -1px
    box-sizing: border-box
    width: calc(100% / 3 + 1px)
    overflow: hidden
    &:hover
    &:last-child
      border-right: 0
    ul
      overflow-x: hidden
      overflow-y: auto
      list-style: none
      width: 100%
      margin: 0
      // Hide scrollbar:
      box-sizing: content-box
      padding: 0 17px 0 0
      height: 7 * $time-picker-line-height
      & > li
        text-align: center
        cursor: pointer
        white-space: nowrap
        overflow: hidden
        height: $time-picker-line-height
        line-height: $time-picker-line-height
        +user-select(none)
        box-sizing: content-box
        width: 100%
        &:first-child
          margin-top: 3 * $time-picker-line-height
        &:last-child
          margin-bottom: 3 * $time-picker-line-height
        &:hover
          background: $color-highlight
        &.selected,
        &.selected:hover
          color: $color-text-inverted
          background: $color-active
        &.disabled
          cursor: not-allowed
          color: #ccc
        &.disabled:hover
          background: transparent

  .dito-time-picker-popup .dito-icon-clear
    position: absolute
    right: 10px
    top: 4px
    cursor: pointer
    opacity: .6
    &:hover
      opacity: 8
</style>

<script>
import Trigger from './Trigger'
// import Icon from '../Icon'
import {
  copyDate, scrollTo, setSelection, getKeyNavigation, leftPad
} from '../utils'

export default {
  components: { Trigger },

  props: {
    value: {
      type: Date,
      default: null
    },
    placeholder: {
      type: String,
      default: 'Choose Time'
    },
    transition: {
      type: String,
      default: 'slide'
    },
    placement: {
      type: String,
      default: 'bottom-left'
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
      default: 'trigger'
    },
    disabledHour: {
      type: Function,
      default: () => false
    },
    disabledMinute: {
      type: Function,
      default: () => false
    },
    disabledSecond: {
      type: Function,
      default: () => false
    }
  },

  data() {
    return {
      date: this.value,
      showPopup: this.show,
      selection: 0
    }
  },

  computed: {
    text() {
      return this.date
        ? `${
          leftPad(this.hours)}:${
          leftPad(this.minutes)}:${
          leftPad(this.seconds)}`
        : ''
    },

    hours: {
      get() {
        return this.date ? this.date.getHours() : 0
      },

      set(hours) {
        this.date = copyDate(this.date, { hours })
      }
    },

    minutes: {
      get() {
        return this.date ? this.date.getMinutes() : 0
      },

      set(minutes) {
        this.date = copyDate(this.date, { minutes })
      }
    },

    seconds: {
      get() {
        return this.date ? this.date.getSeconds() : 0
      },

      set(seconds) {
        this.date = copyDate(this.date, { seconds })
      }
    }
  },

  watch: {
    value(newVal, oldVal) {
      if (+newVal !== +oldVal) {
        this.date = newVal
      }
    },

    date(date) {
      if (+date !== +this.value) {
        this.$emit('input', date)
        this.scrollAll()
      }
    },

    selection() {
      this.updateSelection(false)
    },

    text() {
      this.updateSelection(false)
    },

    showPopup(newVal, oldVal) {
      if (newVal) {
        this.updateSelection()
        this.scrollAll(0)
      }
      if (!newVal !== !oldVal) {
        this.$emit('update:show', newVal)
      }
    }
  },

  methods: {
    leftPad,

    updateSelection(force) {
      if (this.showPopup || force) {
        const start = 3 * this.selection
        this.$nextTick(() => setSelection(this.$refs.input, start, start + 2))
      }
    },

    scrollAll(duration = 100) {
      const scroll = (ref, value) => {
        const target = this.$refs[ref]
        if (target) {
          // First and alst one add 3 times the margin
          const lineHeight = target.scrollHeight / (target.children.length + 6)
          scrollTo(target, Math.round(value * lineHeight), duration)
        }
      }
      this.$nextTick(() => {
        scroll('hours', this.hours)
        scroll('minutes', this.minutes)
        scroll('seconds', this.seconds)
      })
    },

    onKeyDown(event) {
      const selected = ['hours', 'minutes', 'seconds'][this.selection]
      if (selected) {
        const { hor, ver, enter } = getKeyNavigation(event)
        if (hor) {
          const value = this.selection + hor
          this.selection =
            value < 0 ? 2
            : value > 2 ? 0
            : value
        } else if (ver) {
          const value = this[selected] + ver
          const { length } = this.$refs[selected].children
          this[selected] =
            value < 0 ? value + length
            : value >= length ? value - length
            : value
        }
        if (enter) {
          this.showPopup = false
        }
        if (hor || ver || enter) {
          this.updateSelection(true)
          event.preventDefault()
        }
      }
    }
  }
}
</script>
