// Derived from ATUI, and further extended: https://aliqin.github.io/atui/

<template lang="pug">
  trigger.dito-time-picker(
    ref="trigger"
    trigger="click"
    :show.sync="showPopup"
    v-bind="{ transition, placement, disabled, target }"
  )
    input-field.dito-time-picker-input(
      slot="trigger"
      ref="input"
      type="text"
      :value="currentText"
      readonly
      :class="{ 'dito-focus': showPopup }"
      @focus="inputFocused = true"
      @blur="inputFocused = false"
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
        ul.dito-time-picker-hour(
          ref="hour"
          @mouseover="selection = 0"
        )
          li(
            v-for="index in 24"
            v-if="!disabledHour(index - 1)"
            :class="{ selected: hour === index - 1 }"
            @click="hour = index - 1"
          ) {{ leftPad(index - 1) }}
      .dito-time-picker-panel
        ul.dito-time-picker-minute(
          ref="minute"
          @mouseover="selection = 1"
        )
          li(
            v-for="index in 60"
            v-if="!disabledMinute(index - 1)"
            :class="{ selected: minute === index - 1 }"
            @click="minute = index - 1"
          ) {{ leftPad(index - 1) }}
      .dito-time-picker-panel
        ul.dito-time-picker-second(
          ref="second"
          @mouseover="selection = 2"
        )
          li(
            v-for="index in 60"
            v-if="!disabledSecond(index - 1)"
            :class="{ selected: second === index - 1 }"
            @click="second = index - 1"
          ) {{ leftPad(index - 1) }}
</template>

<style lang="sass">
  .dito-time-picker
    .dito-input
      width: 100%

  .dito-time-picker-popup
    max-width: 160px
    margin: $popup-margin

  $time-picker-line-height: 24px
  .dito-time-picker
    .dito-input
      font-variant-numeric: tabular-nums
      cursor: pointer
      width: 100%
      .dito-icon-time
        display: block
        position: absolute
        top: 0
        right: 7px
        height: 100%

  .dito-time-picker-popup
    list-style: none
    background: $color-white
    border: $border-style
    border-radius: $border-radius
    box-shadow: $shadow-window
    overflow: hidden

  .dito-time-picker-popup .dito-time-picker-panel
    float: left
    border: $border-style
    border-width: 0 1px 0
    margin-left: -1px
    box-sizing: border-box
    width: calc(100% / 3 + 1px)
    overflow: hidden
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
        box-sizing: content-box
        background: $color-white
        width: 100%
        height: $time-picker-line-height
        line-height: $time-picker-line-height
        text-align: center
        font-variant-numeric: tabular-nums
        cursor: pointer
        white-space: nowrap
        overflow: hidden
        +user-select(none)
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
          cursor: default
          color: $color-disabled
        &.disabled:hover
          background: transparent
</style>

<script>
import Trigger from './Trigger.vue'
import InputField from './InputField.vue'
import {
  copyDate, scrollTo, setSelection, getKeyNavigation
} from '../utils/index.js'

export default {
  components: { Trigger, InputField },

  props: {
    value: { type: Date, default: null },
    transition: { type: String, default: 'slide' },
    placement: { type: String, default: 'bottom-left' },
    placeholder: { type: String, default: null },
    show: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    target: { type: [String, HTMLElement], default: 'trigger' },
    disabledHour: { type: Function, default: () => false },
    disabledMinute: { type: Function, default: () => false },
    disabledSecond: { type: Function, default: () => false }
  },

  data() {
    return {
      currentValue: this.value,
      showPopup: this.show,
      inputFocused: false,
      selection: 0,
      changed: false
    }
  },

  computed: {
    focused() {
      return this.inputFocused || this.showPopup
    },

    currentText() {
      return this.currentValue
        ? `${
          this.leftPad(this.hour)}:${
          this.leftPad(this.minute)}:${
          this.leftPad(this.second)}`
        : ''
    },

    currentDate() {
      return (
        this.currentValue ||
        // Create a new Date() object with the time set to 0, to be used when
        // first setting any of the times, for meaningful dates in case the
        // object is shared with a DatePicker, e.g. through DateTimePicker.
        copyDate(new Date(), { hour: 0, minute: 0, second: 0 })
      )
    },

    hour: {
      get() {
        return this.currentDate.getHours()
      },

      set(hour) {
        this.setTime({ hour })
      }
    },

    minute: {
      get() {
        return this.currentDate.getMinutes()
      },

      set(minute) {
        this.setTime({ minute })
      }
    },

    second: {
      get() {
        return this.currentDate.getSeconds()
      },

      set(second) {
        this.setTime({ second })
      }
    }
  },

  watch: {
    value(newVal, oldVal) {
      if (+newVal !== +oldVal) {
        this.currentValue = newVal
      }
    },

    currentValue(date) {
      if (+date !== +this.value) {
        this.changed = true
        this.$emit('input', date)
        this.scrollAll()
      }
    },

    currentText: 'updateSelection',

    selection: 'updateSelection',

    show(show) {
      this.showPopup = show
    },

    showPopup(newVal, oldVal) {
      if (newVal) {
        this.updateSelection()
        this.scrollAll(0)
      }
      if (!newVal !== !oldVal) {
        this.$emit('update:show', newVal)
      }
    },

    focused(newVal, oldVal) {
      if (!newVal !== !oldVal) {
        this.$emit(newVal ? 'focus' : 'blur')
      }
    }
  },

  mounted() {
    this.$on('blur', () => {
      if (this.changed) {
        this.changed = false
        this.$emit('change', this.currentValue)
      }
    })
  },

  methods: {
    leftPad(value) {
      return ('0' + value).slice(-2)
    },

    setTime(param) {
      this.currentValue = copyDate(this.currentDate, param)
    },

    updateSelection(force = false) {
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
        scroll('hour', this.hour)
        scroll('minute', this.minute)
        scroll('second', this.second)
      })
    },

    onKeyDown(event) {
      const selected = ['hour', 'minute', 'second'][this.selection]
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
    },

    focus() {
      this.$refs.input.focus()
    },

    blur() {
      this.$refs.input.blur()
    }
  }
}
</script>
