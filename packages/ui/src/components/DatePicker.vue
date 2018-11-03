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
      @keydown="onKeyDown"
      v-on="$listeners"
      v-bind="{ placeholder, disabled }"
    )
    // icon(type="calendar" :color="iconColor")
    calendar.dito-date-picker-popup(
      slot="popup"
      ref="calendar"
      @input="selectDate"
      :value="currentValue"
      v-bind="{ format, locale, disabledDate }"
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
    margin-top: 2px
</style>

<script>
import Trigger from './Trigger'
import Calendar from './Calendar'
import InputField from './InputField'
import { getKeyNavigation } from '../utils'

export default {
  components: { Trigger, Calendar, InputField },

  props: {
    value: { type: Date, default: null },
    transition: { type: String, default: 'slide' },
    placement: { type: String, default: 'bottom-left' },
    placeholder: { type: String, default: null },
    format: { type: String, default: 'yyyy-MM-dd' },
    locale: { type: String, default: 'en-US' },
    show: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    target: { type: [String, HTMLElement], default: 'trigger' },
    disabledDate: { type: Function, default: () => false }
  },

  data() {
    return {
      currentValue: this.value,
      currentText: null,
      showPopup: this.show
    }
  },

  watch: {
    value(newVal, oldVal) {
      if (+newVal !== +oldVal) {
        this.currentValue = newVal
      }
    },

    currentValue(date) {
      this.updateText()
      if (+date !== +this.value) {
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
    }
  },

  methods: {
    updateText() {
      this.currentText = this.currentValue
        ? this.$refs.calendar.stringify(this.currentValue, this.format)
        : ''
    },

    selectDate(date) {
      this.currentValue = date
      this.showPopup = false
    },

    onKeyDown(event) {
      if (this.$refs.calendar.navigate(getKeyNavigation(event))) {
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
