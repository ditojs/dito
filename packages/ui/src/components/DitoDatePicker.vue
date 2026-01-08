<!-- Derived from ATUI, and further extended: https://aliqin.github.io/atui/ -->
<template lang="pug">
DitoTrigger.dito-date-picker(
  ref="trigger"
  v-model:show="showPopup"
  trigger="focus"
  v-bind="{ transition, placement, disabled, target }"
)
  template(#trigger)
    slot(
      v-if="$slots.trigger"
      name="trigger"
    )
    DitoInput.dito-date-picker-input(
      v-else
      ref="input"
      v-model="currentText"
      type="text"
      v-bind="{ placeholder, disabled, focused, ...$attrs }"
      @focus="onFocus(true)"
      @blur="onFocus(false)"
      @keydown="onKeyDown"
      @mousedown.stop="onMouseDown(false)"
    )
      template(#prefix)
        slot(name="prefix")
      template(#suffix)
        DitoIcon(
          name="calendar"
          :disabled="disabled"
          @mousedown.prevent="onMouseDown(true)"
        )
        slot(name="suffix")
  template(#popup)
    DitoCalendar.dito-date-picker-popup(
      ref="calendar"
      v-model="currentValue"
      v-bind="{ locale, disabledDate }"
      @select="showPopup = false"
    )
</template>

<script>
import { format, defaultFormats } from '@ditojs/utils'
import DitoTrigger from './DitoTrigger.vue'
import DitoCalendar from './DitoCalendar.vue'
import DitoInput from './DitoInput.vue'
import DitoIcon from './DitoIcon.vue'
import { parseDate, getDatePartAtPosition } from '../utils/date.js'
import { getSelection, setSelection } from '../utils/selection.js'
import { getKeyNavigation } from '../utils/event.js'
import { getTarget } from '../utils/trigger.js'

export default {
  components: { DitoTrigger, DitoCalendar, DitoInput, DitoIcon },
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
      inputFocused: false
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

    currentValue(value) {
      if (+value !== +this.modelValue) {
        this.$emit('update:modelValue', value)
        this.$emit('change', value)
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

    onMouseDown(toggle) {
      this.showPopup = !this.disabled && (!toggle || !this.showPopup)
      if (this.showPopup) {
        this.focus()
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
  .dito-input {
    font-variant-numeric: tabular-nums;
    width: 100%;
    min-width: 8em;
  }
}

.dito-date-picker-popup {
  margin: $popup-margin;
}
</style>
