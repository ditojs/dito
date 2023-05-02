<template lang="pug">
.dito-date-time-picker(
  ref="picker"
  @mousedown.prevent="onMouseDown(true)"
)
  .dito-date-time-picker__inner(:class="{ 'dito-focus': focused }")
    InputField.dito-date-time-picker__input(
      ref="input"
      v-model="currentText"
      type="text"
      :class="{ 'dito-focus': focused }"
      v-bind="{ placeholder, disabled, ...$attrs }"
      @focus="onFocus(true)"
      @blur="onFocus(false)"
      @keydown="onKeyDown"
      @mousedown.stop="onMouseDown(false)"
    )
      template(#before)
        slot(name="before")
      template(#after)
        Icon(
          name="calendar"
          :disabled="disabled"
        )
        slot(name="after")
    DatePicker(
      ref="date"
      v-model="currentValue"
      v-model:show="showDate"
      placement="bottom-left"
      :target="$refs.picker"
      v-bind="attributes"
      @mousedown.prevent
    )
      template(#trigger)
        //- Intentionally empty
    TimePicker(
      ref="time"
      v-model="currentValue"
      v-model:show="showTime"
      placement="bottom-right"
      :target="$refs.picker"
      v-bind="attributes"
      @mousedown.prevent
    )
      template(#trigger)
        //- Intentionally empty
</template>

<script>
import { format, defaultFormats, merge } from '@ditojs/utils'
import InputField from './InputField.vue'
import DatePicker from './DatePicker.vue'
import TimePicker from './TimePicker.vue'
import Icon from './Icon.vue'
import { parseDate } from '../utils/date.js'
import { getSelection, setSelection } from '../utils/selection.js'
import { getKeyNavigation } from '../utils/event.js'

export default {
  components: { InputField, DatePicker, TimePicker, Icon },
  emits: ['update:modelValue', 'change', 'focus', 'blur'],
  inheritAttrs: false,

  props: {
    modelValue: { type: Date, default: null },
    transition: { type: String, default: 'slide' },
    placeholder: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    locale: { type: String, default: 'en-US' },
    format: { type: Object, default: null }
  },

  data() {
    return {
      currentValue: this.modelValue,
      showDate: false,
      showTime: false,
      inputFocused: false,
      dateFocused: false,
      timeFocused: false,
      closedMode: null
    }
  },

  computed: {
    attributes() {
      const { transition, disabled, locale, formatOptions: format } = this
      return { transition, disabled, locale, format }
    },

    focused() {
      return this.inputFocused || this.showDate || this.showTime
    },

    input() {
      return this.$refs.input.input
    },

    formatOptions() {
      return merge(
        {
          locale: this.locale,
          time: defaultFormats.time,
          date: defaultFormats.date
        },
        {
          date: {
            month: 'short',
            format: (value, type, options) =>
              type === 'literal' && /\bat\b/.test(value)
                ? ', '
                : this.format?.date?.format?.(value, type, options) ?? value
          }
        },
        this.format
      )
    },

    timeIndex() {
      const text = this.currentText
      if (text) {
        const time = text.match(/([\S]+\s*)$/)?.[1]
        if (time) {
          return text.length - time.length
        }
      }
      return null
    },

    currentText: {
      get() {
        return format(this.currentValue, this.formatOptions) || ''
      },

      set(value) {
        const date = parseDate(value, this.formatOptions)
        if (date) {
          const selection = getSelection(this.input)
          this.currentValue = date
          this.$nextTick(() => setSelection(this.input, selection))
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

    focused(to, from) {
      if (to ^ from) {
        this.$emit(to ? 'focus' : 'blur')
      }
    }
  },

  methods: {
    onFocus(focus) {
      this.inputFocused = focus
      if (focus) {
        this.updatePopups()
      } else {
        this.showDate = false
        this.showTime = false
      }
    },

    onMouseDown(toggle) {
      if (toggle && (this.showDate || this.showTime)) {
        this.showDate = false
        this.showTime = false
      } else {
        this.focus()
        requestAnimationFrame(() => this.updatePopups())
      }
    },

    onKeyDown(event) {
      const mode = this.getMode(event)
      this.$refs[mode].onKeyDown(event)
      if (event.defaultPrevented) {
        this.closedMode = mode
      } else if (mode !== this.closedMode) {
        this.updatePopups(mode)
      }
    },

    getMode(event = null) {
      const { start } = getSelection(this.input)
      const { hor: step } = getKeyNavigation(event)
      return this.timeIndex === null || start + step < this.timeIndex
        ? 'date'
        : 'time'
    },

    updatePopups(mode = this.getMode()) {
      if (mode) {
        this.closedMode = null
      }
      this.showDate = mode === 'date'
      this.showTime = mode === 'time'
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

.dito-date-time-picker {
  &__inner {
    display: flex;
  }

  &__input {
    flex: 1;
    font-variant-numeric: tabular-nums;
    min-width: 12em;
  }

  .dito-date-picker,
  .dito-time-picker {
    position: absolute;
  }
}
</style>
