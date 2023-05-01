<!-- Derived from ATUI, and further extended: https://aliqin.github.io/atui/ -->
<template lang="pug">
Trigger.dito-date-picker(
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
    InputField.dito-date-picker-input(
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
  // icon(type="calendar" :color="iconColor")
  template(#popup)
    Calendar.dito-date-picker-popup(
      ref="calendar"
      v-model="currentValue"
      v-bind="{ locale, disabledDate }"
      @select="showPopup = false"
      @mousedown.stop.prevent
    )
</template>

<script>
import { format, defaultFormats } from '@ditojs/utils'
import Trigger from './Trigger.vue'
import Calendar from './Calendar.vue'
import InputField from './InputField.vue'
import { parseDate, getDatePartAtPosition } from '../utils/date.js'
import { getSelection, setSelection } from '../utils/selection.js'
import { getKeyNavigation } from '../utils/event.js'
import { getTarget } from '../utils/trigger.js'

export default {
  components: { Trigger, Calendar, InputField },
  emits: ['update:modelValue', 'update:show', 'focus', 'blur'],
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
        date: defaultFormats.date,
        time: false
      })
    },
    disabledDate: { type: Function, default: () => false }
  },

  data() {
    return {
      currentValue: this.modelValue,
      showPopup: this.show,
      inputFocused: false,
      changed: false
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
    }
  },

  watch: {
    modelValue(to, from) {
      if (+to !== +from) {
        this.currentValue = to
      }
    },

    currentValue(currentValue) {
      if (+currentValue !== +this.modelValue) {
        this.changed = true
        this.$emit('update:modelValue', currentValue)
      }
    },

    show(show) {
      this.showPopup = show
    },

    showPopup(to, from) {
      if (to ^ from) {
        this.$emit('update:show', to)
      }
    },

    focused(to, from) {
      if (to ^ from) {
        this.$emit(to ? 'focus' : 'blur')
        if (!to && this.changed) {
          // TODO: This seems to contradict the `currentValue()` watcher above.
          //       Is this needed at all?
          this.changed = false
          this.$emit('update:modelValue', this.currentValue)
        }
      }
    }
  },

  methods: {
    onFocus(focus) {
      this.inputFocused = focus
      this.showPopup = focus
    },

    onKeyDown(event) {
      const { ver: step, enter } = getKeyNavigation(event)
      if (step || enter) {
        event.preventDefault()

        const position = getSelection(this.input)?.start
        const getDatePart = position =>
          getDatePartAtPosition(this.currentText, position, this.formatOptions)

        if (step && !this.showPopup) {
          this.showPopup = true
        } else {
          const { calendar } = this.$refs
          if (calendar) {
            const { name: mode, start } = getDatePart(position) || {}
            if (
              mode &&
              calendar.navigate({ step, enter, mode, update: true })
            ) {
              this.$nextTick(() => setSelection(this.input, getDatePart(start)))
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

.dito-date-picker {
  min-width: 10em;

  .dito-input {
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    width: 100%;
  }
}

.dito-date-picker-popup {
  margin: $popup-margin;
}
</style>
