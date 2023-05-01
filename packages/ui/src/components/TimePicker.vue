<!-- Derived from ATUI, and further extended: https://aliqin.github.io/atui/ -->
<template lang="pug">
Trigger.dito-time-picker(
  ref="trigger"
  v-model:show="showPopup"
  trigger="click"
  v-bind="{ transition, placement, disabled, target }"
)
  template(#trigger)
    slot(
      v-if="$slots.trigger"
      name="trigger"
    )
    InputField.dito-time-picker-input(
      v-else
      ref="input"
      v-model="currentText"
      type="text"
      :class="{ 'dito-focus': focused }"
      v-bind="{ placeholder, disabled, ...$attrs }"
      @focus="onFocus(true)"
      @blur="onFocus(false)"
      @keydown="onKeyDown"
    )
    //- icon(type="time"
    //- :color="disabled ? '#bfbfbf' : (text ? '#666' : '#bfbfbf')"
    //- )
  template(#popup)
    .dito-time-picker-popup(
      @mousedown.stop.prevent
    )
      .dito-time-picker-panel
        ul.dito-time-picker-hour(ref="hour")
          template(
            v-for="index in 24"
          )
            li(
              v-if="!disabledHour(index - 1)"
              :class="{ selected: hour === index - 1 }"
              @click="hour = index - 1"
            ) {{ leftPad(index - 1) }}
      .dito-time-picker-panel
        ul.dito-time-picker-minute(ref="minute")
          template(
            v-for="index in 60"
          )
            li(
              v-if="!disabledMinute(index - 1)"
              :class="{ selected: minute === index - 1 }"
              @click="minute = index - 1"
            ) {{ leftPad(index - 1) }}
      .dito-time-picker-panel
        ul.dito-time-picker-second(ref="second")
          template(
            v-for="index in 60"
          )
            li(
              v-if="!disabledSecond(index - 1)"
              :class="{ selected: second === index - 1 }"
              @click="second = index - 1"
            ) {{ leftPad(index - 1) }}
</template>

<script>
import { format, defaultFormats } from '@ditojs/utils'
import Trigger from './Trigger.vue'
import InputField from './InputField.vue'
import { copyDate, parseDate, getDatePartAtPosition } from '../utils/date.js'
import { getSelection, setSelection } from '../utils/selection.js'
import { getKeyNavigation } from '../utils/event.js'
import { getTarget } from '../utils/trigger.js'

export default {
  components: { Trigger, InputField },
  emits: ['update:modelValue', 'update:show', 'change', 'focus', 'blur'],
  inheritAttrs: false,

  props: {
    modelValue: { type: Date, default: null },
    transition: { type: String, default: 'slide' },
    placement: { type: String, default: 'bottom-left' },
    placeholder: { type: String, default: null },
    show: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    target: { type: [String, HTMLElement], default: 'trigger' },
    locale: { type: String, default: 'en-US' },
    format: {
      type: Object,
      default: () => ({
        time: defaultFormats.time,
        date: false
      })
    },
    disabledHour: { type: Function, default: () => false },
    disabledMinute: { type: Function, default: () => false },
    disabledSecond: { type: Function, default: () => false }
  },

  data() {
    return {
      currentValue: this.modelValue,
      showPopup: this.show,
      inputFocused: false,
      changed: false,
      ignoreNextChange: false
    }
  },

  computed: {
    focused() {
      return this.inputFocused || this.showPopup
    },

    input() {
      return getTarget(this)?.querySelector('input')
    },

    formatOptions() {
      return {
        locale: this.locale,
        ...this.format
      }
    },

    currentText: {
      get() {
        return format(this.currentValue, this.formatOptions) || ''
      },

      set(value) {
        const date = parseDate(value, this.formatOptions)
        if (date) {
          this.currentValue = date
        }
      }
    },

    currentDate() {
      return (
        this.currentValue ||
        // Create a new Date() object with the time set to 0, to be used when
        // first setting any of the times, for meaningful dates in case the
        // object is shared with a DatePicker, e.g. through DateTimePicker.
        copyDate(new Date(), { hour: 0, minute: 0, second: 0, millisecond: 0 })
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
    modelValue(to, from) {
      if (+to !== +from) {
        this.currentValue = to
        this.scrollAll(true)
      }
    },

    currentValue(date) {
      if (+date !== +this.modelValue) {
        this.changed = true
        this.$emit('update:modelValue', date)
        this.scrollAll(true)
      }
    },

    currentText() {
      const { input } = this
      const selection = getSelection(input)
      if (
        this.focused &&
        !this.ignoreNextChange &&
        selection.start === selection.end
      ) {
        this.$nextTick(() => setSelection(input, selection))
      }
      this.ignoreNextChange = false
    },

    show(show) {
      this.showPopup = show
    },

    showPopup(to, from) {
      if (to) {
        this.scrollAll(false)
      }
      if (to ^ from) {
        this.$emit('update:show', to)
      }
    },

    focused(to, from) {
      if (to ^ from) {
        this.$emit(to ? 'focus' : 'blur')
        if (!to && this.changed) {
          this.changed = false
          this.$emit('change', this.currentValue)
        }
      }
    }
  },

  methods: {
    leftPad(value) {
      return ('0' + value).slice(-2)
    },

    setTime(overrides) {
      this.currentValue = copyDate(this.currentDate, {
        ...overrides,
        millisecond: 0
      })
    },

    scrollAll(smooth) {
      const scroll = (ref, value) => {
        const target = this.$refs[ref]
        if (target) {
          const lineHeight = (
            target.scrollHeight /
            // First and last one add 3 times the margin.
            (target.childElementCount + 6)
          )
          target.scrollTo({
            top: Math.round(value * lineHeight),
            behavior: smooth ? 'smooth' : 'auto'
          })
        }
      }
      this.$nextTick(() => {
        scroll('hour', this.hour)
        scroll('minute', this.minute)
        scroll('second', this.second)
      })
    },

    onFocus(focus) {
      this.inputFocused = focus
      this.showPopup = focus
    },

    onKeyDown(event) {
      const { input } = this
      const selection = getSelection(input)
      const { ver: step, enter } = getKeyNavigation(event)
      if (step || enter) {
        event.preventDefault()

        const getDatePart = position =>
          getDatePartAtPosition(this.currentText, position, this.formatOptions)

        if (step) {
          if (!this.showPopup) {
            this.showPopup = true
          } else {
            const { name, start } = getDatePart(selection.start) || {}
            if (name) {
              const value = this[name] + step
              const count = this.$refs[name].childElementCount
              this[name] =
                value < 0
                  ? value + count
                  : value >= count
                    ? value - count
                    : value
              this.ignoreNextChange = true
              this.$nextTick(() => setSelection(input, getDatePart(start)))
            }
          }
        } else if (enter) {
          this.showPopup = false
        }
      } else if (selection.start === selection.end) {
        const { value } = input
        let pos = selection.start

        const isDigit = char => !isNaN(parseInt(char, 10))

        if (event.key.length === 1) {
          if (isDigit(event.key) && pos < value.length) {
            if (
              value[pos] === ':' &&
              isDigit(value[pos - 1]) &&
              isDigit(value[pos - 2])
            ) {
              pos++
            }
            // Remove next digit so the event overrides it instead of inserting
            // new chars.
            if (
              isDigit(value[pos]) && (
                isDigit(value[pos + 1]) ||
                isDigit(value[pos - 1])
              )
            ) {
              input.value = (
                value.slice(0, pos) +
                value.slice(pos + 1)
              )
              setSelection(input, { start: pos, end: pos })
            }
          } else {
            const length = format(this.currentValue, this.formatOptions).length
            if (value.length === length) {
              event.preventDefault()
            } else if (value.length > length) {
              input.value = value.slice(0, length)
              setSelection(input, selection)
              event.preventDefault()
            }
          }
        } else if (event.key === 'Backspace') {
          if (
            pos === 1 ||
            [' ', ':'].includes(value[pos - 2])
          ) {
            if (
              pos === value.length ||
              value[pos] === ':'
            ) {
              pos--
              input.value = (
                value.slice(0, pos) +
                ((value[pos - 1] ?? '') + '00') +
                value.slice(pos + 1)
              )
              setSelection(input, { start: pos, end: pos })
            } else if (
              isDigit(value[pos]) &&
              !isDigit(+value[pos + 1])
            ) {
              // When removing the first of two digits, replace with 0
              input.value = value.slice(0, pos) + '0' + value.slice(pos)
              setSelection(input, { start: pos, end: pos })
            }
          }
        }
      }
    },

    focus() {
      this.input.focus()
    },

    blur() {
      this.input.blur()
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-time-picker {
  .dito-input {
    width: 100%;
  }
}

.dito-time-picker-popup {
  max-width: 160px;
  margin: $popup-margin;
}

$time-picker-line-height: 24px;

.dito-time-picker {
  .dito-input {
    font-variant-numeric: tabular-nums;
    width: 100%;

    .dito-icon-time {
      display: block;
      position: absolute;
      top: 0;
      right: 7px;
      height: 100%;
    }
  }
}

.dito-time-picker-popup {
  list-style: none;
  background: $color-white;
  border: $border-style;
  border-radius: $border-radius;
  box-shadow: $shadow-window;
  overflow: hidden;
}

.dito-time-picker-popup .dito-time-picker-panel {
  float: left;
  border: $border-style;
  border-width: 0 1px 0;
  margin-left: -1px;
  box-sizing: border-box;
  width: calc(100% / 3 + 1px);
  overflow: hidden;

  &:last-child {
    border-right: 0;
  }

  ul {
    overflow-x: hidden;
    overflow-y: auto;
    list-style: none;
    width: 100%;
    margin: 0;
    // Hide scrollbar:
    box-sizing: content-box;
    padding: 0 17px 0 0;
    height: 7 * $time-picker-line-height;

    & > li {
      box-sizing: content-box;
      background: $color-white;
      width: 100%;
      height: $time-picker-line-height;
      line-height: $time-picker-line-height;
      text-align: center;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      @include user-select(none);

      &:first-child {
        margin-top: 3 * $time-picker-line-height;
      }

      &:last-child {
        margin-bottom: 3 * $time-picker-line-height;
      }

      &:hover {
        background: $color-highlight;
      }

      &.selected,
      &.selected:hover {
        color: $color-text-inverted;
        background: $color-active;
      }

      &.disabled {
        cursor: default;
        color: $color-disabled;
      }

      &.disabled:hover {
        background: transparent;
      }
    }
  }
}
</style>
