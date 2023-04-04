// Derived from ATUI, and further extended: https://aliqin.github.io/atui/

<template lang="pug">
trigger.dito-date-picker(
  ref="trigger"
  trigger="click"
  v-model:show="showPopup"
  v-bind="{ transition, placement, disabled, target }"
)
  template(#trigger)
    input-field.dito-date-picker-input(
      ref="input"
      type="text"
      v-model="currentText"
      readonly
      :class="{ 'dito-focus': showPopup }"
      @focus="inputFocused = true"
      @blur="inputFocused = false"
      @keydown="onKeyDown"
      v-bind="{ placeholder, disabled }"
    )
  // icon(type="calendar" :color="iconColor")
  template(#popup)
    calendar.dito-date-picker-popup(
      ref="calendar"
      v-model="currentValue"
      v-bind="{ locale, disabledDate }"
    )
</template>

<style lang="sass">
  @import '../styles/_imports'

  .dito-date-picker
    min-width: 10em
    .dito-input
      font-variant-numeric: tabular-nums
      cursor: pointer
      width: 100%
  .dito-date-picker-popup
    margin: $popup-margin
</style>

<script>
import { format, defaultFormats } from '@ditojs/utils'
import Trigger from './Trigger.vue'
import Calendar from './Calendar.vue'
import InputField from './InputField.vue'
import { getKeyNavigation } from '../utils/event.js'

export default {
  components: { Trigger, Calendar, InputField },

  props: {
    modelValue: { type: Date, default: null },
    transition: { type: String, default: 'slide' },
    placement: { type: String, default: 'bottom-left' },
    placeholder: { type: String, default: null },
    locale: { type: String, default: 'en-US' },
    dateFormat: { type: Object, default: () => defaultFormats.date },
    show: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    target: { type: [String, HTMLElement], default: 'trigger' },
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

    currentText() {
      return format(this.currentValue, {
        locale: this.locale,
        date: this.dateFormat,
        time: false
      }) || ''
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
        this.showPopup = false
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
          this.changed = false
          // TODO:
          this.$emit('update:modelValue', this.currentValue)
        }
      }
    }
  },

  methods: {
    onKeyDown(event) {
      if (this.$refs.calendar?.navigate(getKeyNavigation(event))) {
        event.preventDefault()
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
