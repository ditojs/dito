// Derived from ATUI, and further extended: https://aliqin.github.io/atui/

<template lang="pug">
  trigger.dito-date-picker(
    ref="trigger"
    trigger="click"
    :show.sync="showPopup"
    v-bind="{ transition, placement, disabled, target }"
  )
    input.dito-input.dito-date-picker-input(
      slot="trigger"
      ref="input"
      type="text"
      :value="text"
      readonly
      :class="{ 'dito-focus': showPopup }"
      @keydown="onKeyDown"
      @focus="$emit('focus')"
      @blur="$emit('blur')"
      v-bind="{ placeholder, disabled }"
    )
    // icon(type="calendar" :color="iconColor")
    calendar.dito-date-picker-popup(
      slot="popup"
      ref="calendar"
      @input="selectDate"
      :value="date"
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
import { getKeyNavigation } from '../utils'

export default {
  components: {
    Trigger, Calendar
  },

  props: {
    value: {
      type: Date,
      default: null
    },
    transition: {
      type: String,
      default: 'slide'
    },
    placement: {
      type: String,
      default: 'bottom-left'
    },
    placeholder: {
      type: String,
      default: null
    },
    format: {
      type: String,
      default: 'yyyy-MM-dd'
    },
    locale: {
      type: String,
      default: 'en-US'
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
    disabledDate: {
      type: Function,
      default: () => false
    }
  },

  data() {
    return {
      date: this.value,
      text: null,
      showPopup: this.show,
      iconColor: '#bfbfbf'
    }
  },

  watch: {
    value(newVal, oldVal) {
      if (+newVal !== +oldVal) {
        this.date = newVal
        this.iconColor = newVal ? '#666' : '#bfbfbf'
      }
    },

    date(date) {
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

  mounted() {
    this.updateText()
  },

  methods: {
    updateText() {
      this.text = this.date
        ? this.$refs.calendar.stringify(this.date, this.format)
        : ''
    },

    selectDate(date) {
      this.date = date
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
