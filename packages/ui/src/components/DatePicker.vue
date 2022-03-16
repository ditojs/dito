// Derived from ATUI, and further extended: https://aliqin.github.io/atui/

<template lang="pug">
  trigger.dito-date-picker(
    ref="trigger"
    trigger="click"
    :show.sync="showPopup"
    v-bind="{ transition, placement, disabled, target }"
  )
    input-field.dito-date-picker-input(
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
    // icon(type="calendar" :color="iconColor")
    calendar.dito-date-picker-popup(
      slot="popup"
      ref="calendar"
      @input="selectDate"
      :value="currentValue"
      v-bind="{ locale, disabledDate }"
    )
</template>

<style lang="sass">
  .dito-date-picker
    min-width: 240px
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
import { getKeyNavigation } from '../utils/index.js'

export default {
  components: { Trigger, Calendar, InputField },

  props: {
    value: { type: Date, default: null },
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
      currentValue: this.value,
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
    value(newVal, oldVal) {
      if (+newVal !== +oldVal) {
        this.currentValue = newVal
      }
    },

    currentValue(date) {
      if (+date !== +this.value) {
        this.changed = true
        this.$emit('input', date)
      }
    },

    show(show) {
      this.showPopup = show
    },

    showPopup(newVal, oldVal) {
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
    selectDate(date) {
      this.currentValue = date
      this.showPopup = false
    },

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
